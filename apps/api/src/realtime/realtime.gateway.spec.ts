import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  const peerMemberships = [
    {
      conversation: {
        members: [{ userId: 'alice' }, { userId: 'bob' }]
      }
    }
  ];

  function setup() {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'alice',
        username: 'alice'
      })
    };
    const prisma = {
      conversationMember: {
        findMany: jest.fn().mockResolvedValue(peerMemberships),
        findUnique: jest.fn()
      }
    };
    const roomEmitter = { emit: jest.fn() };
    const server = {
      to: jest.fn().mockReturnValue(roomEmitter)
    };
    const gateway = new RealtimeGateway(jwt as never, prisma as never);
    gateway.server = server as never;

    const rooms = new Set<string>();
    const client = {
      id: 'socket-alice',
      data: {} as { userId?: string; username?: string },
      rooms,
      handshake: {
        auth: { token: 'valid-token' },
        headers: {}
      },
      join: jest.fn((room: string) => rooms.add(room)),
      leave: jest.fn((room: string) => rooms.delete(room)),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue(roomEmitter),
      disconnect: jest.fn()
    };

    return {
      gateway,
      jwt,
      prisma,
      server,
      roomEmitter,
      client
    };
  }

  it('authenticates a socket and only announces presence to conversation peers', async () => {
    const { gateway, client, server, roomEmitter } = setup();

    await gateway.handleConnection(client as never);

    expect(client.data).toEqual({ userId: 'alice', username: 'alice' });
    expect(client.join).toHaveBeenCalledWith('user:alice');
    expect(server.to).toHaveBeenCalledWith('user:bob');
    expect(roomEmitter.emit).toHaveBeenCalledWith('presence:update', {
      userId: 'alice',
      online: true
    });
  });

  it('disconnects sockets with invalid tokens', async () => {
    const { gateway, client, jwt } = setup();
    jwt.verifyAsync.mockRejectedValueOnce(new Error('invalid'));

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects unauthorized room joins and accepts valid memberships', async () => {
    const { gateway, client, prisma } = setup();
    client.data.userId = 'alice';

    prisma.conversationMember.findUnique.mockResolvedValueOnce(null);
    await gateway.joinConversation(client as never, {
      conversationId: 'secret-conversation'
    });

    expect(client.emit).toHaveBeenCalledWith('conversation:error', {
      conversationId: 'secret-conversation',
      message: 'Accès interdit à cette conversation.'
    });
    expect(client.join).not.toHaveBeenCalledWith(
      'conversation:secret-conversation'
    );

    prisma.conversationMember.findUnique.mockResolvedValueOnce({ id: 'member' });
    await gateway.joinConversation(client as never, {
      conversationId: 'allowed-conversation'
    });

    expect(client.join).toHaveBeenCalledWith(
      'conversation:allowed-conversation'
    );
    expect(client.emit).toHaveBeenCalledWith('conversation:joined', {
      conversationId: 'allowed-conversation'
    });
  });

  it('only broadcasts typing from sockets that joined the conversation room', () => {
    const { gateway, client, roomEmitter } = setup();
    client.data.userId = 'alice';
    client.data.username = 'alice';

    gateway.typingStart(client as never, { conversationId: 'chat' });
    expect(client.to).not.toHaveBeenCalled();

    client.rooms.add('conversation:chat');
    gateway.typingStart(client as never, { conversationId: 'chat' });

    expect(client.to).toHaveBeenCalledWith('conversation:chat');
    expect(roomEmitter.emit).toHaveBeenCalledWith('typing:update', {
      conversationId: 'chat',
      userId: 'alice',
      username: 'alice',
      typing: true
    });
  });

  it('filters presence snapshots to allowed peers', async () => {
    const { gateway, client } = setup();
    client.data.userId = 'alice';
    const online = (gateway as unknown as {
      online: Map<string, Set<string>>;
    }).online;
    online.set('bob', new Set(['socket-bob']));
    online.set('outsider', new Set(['socket-outsider']));

    await gateway.queryPresence(client as never, {
      userIds: ['bob', 'outsider']
    });

    expect(client.emit).toHaveBeenCalledWith('presence:snapshot', {
      onlineUserIds: ['bob']
    });
  });

  it('allows calls only between known conversation peers', async () => {
    const { gateway, client, server, roomEmitter } = setup();
    client.data.userId = 'alice';
    client.data.username = 'alice';

    await gateway.forwardOffer(client as never, {
      targetUserId: 'outsider',
      callId: 'call-denied',
      media: 'audio',
      offer: { type: 'offer', sdp: 'denied' }
    });

    expect(client.emit).toHaveBeenCalledWith('call:error', {
      callId: 'call-denied',
      targetUserId: 'outsider',
      message: 'Tu ne peux appeler que les membres de tes conversations.'
    });
    expect(server.to).not.toHaveBeenCalledWith('user:outsider');

    await gateway.forwardOffer(client as never, {
      targetUserId: 'bob',
      callId: 'call-allowed',
      media: 'video',
      offer: { type: 'offer', sdp: 'allowed' }
    });

    expect(server.to).toHaveBeenCalledWith('user:bob');
    expect(roomEmitter.emit).toHaveBeenCalledWith('call:incoming', {
      callId: 'call-allowed',
      callerUserId: 'alice',
      callerUsername: 'alice',
      offer: { type: 'offer', sdp: 'allowed' },
      media: 'video'
    });
  });

  it('broadcasts messages and read states to all member user rooms', async () => {
    const { gateway, prisma, server, roomEmitter } = setup();
    prisma.conversationMember.findMany.mockResolvedValue([
      { userId: 'alice' },
      { userId: 'bob' }
    ]);

    await gateway.emitMessageCreated('chat', { id: 'message-1' });
    expect(server.to).toHaveBeenCalledWith([
      'conversation:chat',
      'user:alice',
      'user:bob'
    ]);
    expect(roomEmitter.emit).toHaveBeenCalledWith('message:created', {
      id: 'message-1'
    });

    const readAt = new Date('2026-08-01T08:00:00.000Z');
    await gateway.emitConversationRead('chat', {
      userId: 'bob',
      lastReadAt: readAt
    });
    expect(roomEmitter.emit).toHaveBeenCalledWith('conversation:read', {
      conversationId: 'chat',
      userId: 'bob',
      lastReadAt: readAt
    });
  });
});
