import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

type AuthSocket = Socket & {
  data: {
    userId?: string;
    username?: string;
  };
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly online = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: AuthSocket) {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        username: string;
      }>(token);

      client.data.userId = payload.sub;
      client.data.username = payload.username;
      client.join(`user:${payload.sub}`);

      const sockets = this.online.get(payload.sub) ?? new Set<string>();
      const wasOffline = sockets.size === 0;
      sockets.add(client.id);
      this.online.set(payload.sub, sockets);

      if (wasOffline) {
        await this.emitPresenceToPeers(payload.sub, true);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthSocket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sockets = this.online.get(userId);
    if (!sockets) return;

    sockets.delete(client.id);

    if (sockets.size === 0) {
      this.online.delete(userId);
      await this.emitPresenceToPeers(userId, false);
    }
  }

  @SubscribeMessage('presence:query')
  async queryPresence(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { userIds?: string[] }
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const requested = [...new Set((body?.userIds ?? []).filter(Boolean))].slice(0, 100);
    const allowed = await this.allowedPresenceUserIds(userId);
    const onlineUserIds = requested.filter(
      (candidate) => allowed.has(candidate) && this.online.has(candidate)
    );

    client.emit('presence:snapshot', { onlineUserIds });
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversationId: string }
  ) {
    const userId = client.data.userId;
    if (!userId || !body?.conversationId) return;

    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: body.conversationId,
          userId
        }
      },
      select: { id: true }
    });

    if (!member) {
      client.emit('conversation:error', {
        conversationId: body.conversationId,
        message: 'Accès interdit à cette conversation.'
      });
      return;
    }

    client.join(`conversation:${body.conversationId}`);
    client.emit('conversation:joined', { conversationId: body.conversationId });
  }

  @SubscribeMessage('conversation:leave')
  leaveConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversationId: string }
  ) {
    if (body?.conversationId) {
      client.leave(`conversation:${body.conversationId}`);
    }
  }

  @SubscribeMessage('typing:start')
  typingStart(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversationId: string }
  ) {
    this.emitTyping(client, body?.conversationId, true);
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversationId: string }
  ) {
    this.emitTyping(client, body?.conversationId, false);
  }

  @SubscribeMessage('call:offer')
  forwardOffer(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: {
      targetUserId: string;
      callId: string;
      offer: RTCSessionDescriptionInit;
      media: 'audio' | 'video';
    }
  ) {
    if (!client.data.userId || !body.targetUserId) return;

    this.server.to(`user:${body.targetUserId}`).emit('call:incoming', {
      callId: body.callId,
      callerUserId: client.data.userId,
      callerUsername: client.data.username,
      offer: body.offer,
      media: body.media
    });
  }

  @SubscribeMessage('call:answer')
  forwardAnswer(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: {
      targetUserId: string;
      callId: string;
      answer: RTCSessionDescriptionInit;
    }
  ) {
    if (!client.data.userId || !body.targetUserId) return;

    this.server.to(`user:${body.targetUserId}`).emit('call:answered', {
      callId: body.callId,
      responderUserId: client.data.userId,
      answer: body.answer
    });
  }

  @SubscribeMessage('call:ice-candidate')
  forwardIceCandidate(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: {
      targetUserId: string;
      callId: string;
      candidate: RTCIceCandidateInit;
    }
  ) {
    if (!client.data.userId || !body.targetUserId) return;

    this.server
      .to(`user:${body.targetUserId}`)
      .emit('call:ice-candidate', {
        callId: body.callId,
        senderUserId: client.data.userId,
        candidate: body.candidate
      });
  }

  @SubscribeMessage('call:end')
  endCall(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: {
      targetUserId: string;
      callId: string;
      reason?: string;
    }
  ) {
    if (!client.data.userId || !body.targetUserId) return;

    this.server.to(`user:${body.targetUserId}`).emit('call:ended', {
      callId: body.callId,
      senderUserId: client.data.userId,
      reason: body.reason ?? 'ended'
    });
  }

  async emitMessageCreated(conversationId: string, message: unknown) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true }
    });

    const rooms = [
      `conversation:${conversationId}`,
      ...members.map((member) => `user:${member.userId}`)
    ];

    this.server.to(rooms).emit('message:created', message);
  }

  async emitConversationRead(
    conversationId: string,
    state: { userId: string; lastReadAt: Date }
  ) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true }
    });

    const rooms = [
      `conversation:${conversationId}`,
      ...members.map((member) => `user:${member.userId}`)
    ];

    this.server.to(rooms).emit('conversation:read', {
      conversationId,
      userId: state.userId,
      lastReadAt: state.lastReadAt
    });
  }

  private emitTyping(
    client: AuthSocket,
    conversationId: string | undefined,
    typing: boolean
  ) {
    if (!conversationId || !client.data.userId) return;

    const room = `conversation:${conversationId}`;
    if (!client.rooms.has(room)) return;

    client.to(room).emit('typing:update', {
      conversationId,
      userId: client.data.userId,
      username: client.data.username,
      typing
    });
  }

  private async emitPresenceToPeers(userId: string, online: boolean) {
    const peers = await this.allowedPresenceUserIds(userId);
    peers.delete(userId);

    for (const peerId of peers) {
      this.server.to(`user:${peerId}`).emit('presence:update', {
        userId,
        online
      });
    }
  }

  private async allowedPresenceUserIds(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: {
        conversation: {
          select: {
            members: { select: { userId: true } }
          }
        }
      }
    });

    const allowed = new Set<string>([userId]);
    for (const membership of memberships) {
      for (const member of membership.conversation.members) {
        allowed.add(member.userId);
      }
    }

    return allowed;
  }
}
