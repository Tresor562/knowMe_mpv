import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

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

  constructor(private readonly jwt: JwtService) {}

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
      sockets.add(client.id);
      this.online.set(payload.sub, sockets);

      this.server.emit('presence:update', {
        userId: payload.sub,
        online: true
      });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthSocket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sockets = this.online.get(userId);
    if (!sockets) return;

    sockets.delete(client.id);

    if (sockets.size === 0) {
      this.online.delete(userId);
      this.server.emit('presence:update', {
        userId,
        online: false
      });
    }
  }

  @SubscribeMessage('conversation:join')
  joinConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversationId: string }
  ) {
    if (client.data.userId && body?.conversationId) {
      client.join(`conversation:${body.conversationId}`);
    }
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
    client
      .to(`conversation:${body.conversationId}`)
      .emit('typing:update', {
        conversationId: body.conversationId,
        userId: client.data.userId,
        username: client.data.username,
        typing: true
      });
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversationId: string }
  ) {
    client
      .to(`conversation:${body.conversationId}`)
      .emit('typing:update', {
        conversationId: body.conversationId,
        userId: client.data.userId,
        username: client.data.username,
        typing: false
      });
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

  emitMessageCreated(conversationId: string, message: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:created', message);
  }
}
