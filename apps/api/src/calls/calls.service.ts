import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  TooManyRequestsException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CallPreferencesService } from './call-preferences.service';
import { CreateCallDto } from './dto/call.dto';

type Tx = Prisma.TransactionClient;
type SignalAction = 'OFFER' | 'ANSWER' | 'ICE' | 'END';

type CallRecord = {
  id: string;
  callerId: string;
  calleeId: string;
  media: 'AUDIO' | 'VIDEO';
  status: 'RINGING' | 'ACTIVE' | 'ENDED' | 'REJECTED' | 'MISSED' | 'CANCELLED';
  offerForwardedAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  expiresAt: Date;
  endedById: string | null;
  endReason:
    | 'HANGUP'
    | 'REJECTED'
    | 'MISSED'
    | 'CANCELLED'
    | 'ACCOUNT_DELETED'
    | 'MODERATION'
    | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const RING_TIMEOUT_MS = 45_000;
const MAX_CALLS_PER_HOUR = 20;
const TERMINAL_STATUSES = ['ENDED', 'REJECTED', 'MISSED', 'CANCELLED'];

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly preferences: CallPreferencesService
  ) {}

  async create(callerId: string, dto: CreateCallDto) {
    const replay = await this.prisma.callReceipt.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: callerId,
          idempotencyKey: dto.idempotencyKey
        }
      }
    });
    if (replay) {
      return { ...(await this.view(callerId, replay.callId)), replayed: true };
    }
    if (dto.calleeUserId === callerId) {
      throw new BadRequestException({
        code: 'CALL_SELF_FORBIDDEN',
        message: 'Tu ne peux pas t’appeler toi-même.'
      });
    }
    await this.assertHourlyLimit(callerId);

    const callId = await this.serializable(async (tx) => {
      const duplicate = await tx.callReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: callerId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return duplicate.callId;

      const [caller, callee, sharedConversation, busyCall] = await Promise.all([
        tx.user.findUnique({
          where: { id: callerId },
          select: { id: true, isSuspended: true }
        }),
        tx.user.findUnique({
          where: { id: dto.calleeUserId },
          select: { id: true, isSuspended: true }
        }),
        tx.conversationMember.findFirst({
          where: {
            userId: callerId,
            conversation: {
              members: { some: { userId: dto.calleeUserId } }
            }
          },
          select: { conversationId: true }
        }),
        tx.callSession.findFirst({
          where: {
            status: { in: ['RINGING', 'ACTIVE'] },
            OR: [
              { callerId: { in: [callerId, dto.calleeUserId] } },
              { calleeId: { in: [callerId, dto.calleeUserId] } }
            ]
          },
          select: { id: true }
        })
      ]);

      if (!caller || caller.isSuspended || !callee || callee.isSuspended) {
        throw new ForbiddenException({
          code: 'CALL_ACCOUNT_INELIGIBLE',
          message: 'Un des comptes ne peut pas participer à cet appel.'
        });
      }
      if (!sharedConversation) {
        throw new ForbiddenException({
          code: 'CALL_SHARED_CONVERSATION_REQUIRED',
          message: 'Tu ne peux appeler que les membres de tes conversations.'
        });
      }
      await this.preferences.assertCanReceive(
        dto.calleeUserId,
        dto.media,
        new Date(),
        tx
      );
      if (busyCall) {
        throw new ConflictException({
          code: 'CALL_PARTICIPANT_BUSY',
          message: 'Un participant est déjà engagé dans un autre appel.'
        });
      }

      const call = await tx.callSession.create({
        data: {
          callerId,
          calleeId: dto.calleeUserId,
          media: dto.media === 'video' ? 'VIDEO' : 'AUDIO',
          status: 'RINGING',
          creationKey: dto.idempotencyKey,
          expiresAt: new Date(Date.now() + RING_TIMEOUT_MS)
        }
      });
      await tx.callEvent.create({
        data: {
          callId: call.id,
          actorId: callerId,
          action: 'CALL_CREATED',
          metadata: this.json({
            media: call.media,
            conversationId: sharedConversation.conversationId,
            clientCallIdAccepted: false,
            serverAuthoritative: true
          })
        }
      });
      await tx.callReceipt.create({
        data: {
          userId: callerId,
          idempotencyKey: dto.idempotencyKey,
          operation: 'CREATE_CALL',
          callId: call.id
        }
      });
      return call.id;
    });

    await this.audit.record({
      actorId: callerId,
      action: 'CALL_CREATED',
      entity: 'CallSession',
      entityId: callId,
      metadata: {
        calleeId: dto.calleeUserId,
        media: dto.media,
        clientCallIdAccepted: false
      }
    });
    return { ...(await this.view(callerId, callId)), replayed: false };
  }

  async view(userId: string, callId: string) {
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call) throw this.notFound();
    this.assertParticipant(call, userId);
    const peerId = call.callerId === userId ? call.calleeId : call.callerId;
    const peer = await this.prisma.user.findUnique({
      where: { id: peerId },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    return this.present(call as CallRecord, userId, peer);
  }

  async history(userId: string, take = 50) {
    const calls = await this.prisma.callSession.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(100, Math.max(1, take))
    });
    const peerIds = [
      ...new Set(
        calls.map((call) =>
          call.callerId === userId ? call.calleeId : call.callerId
        )
      )
    ];
    const peers = peerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: peerIds } },
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        })
      : [];
    const peerMap = new Map(peers.map((peer) => [peer.id, peer]));
    return calls.map((call) => {
      const peerId = call.callerId === userId ? call.calleeId : call.callerId;
      return this.present(
        call as CallRecord,
        userId,
        peerMap.get(peerId) ?? null
      );
    });
  }

  async authorizeSignal(
    actorId: string,
    targetUserId: string,
    callId: string,
    action: SignalAction,
    reason?: string
  ) {
    const result = await this.serializable(async (tx) => {
      const call = await tx.callSession.findUnique({ where: { id: callId } });
      if (!call) throw this.notFound();
      this.assertSignalPair(call as CallRecord, actorId, targetUserId);

      if (call.status === 'RINGING' && call.expiresAt <= new Date()) {
        return { expired: true as const, call: call as CallRecord, ended: false };
      }

      if (action === 'OFFER') {
        if (call.callerId !== actorId || call.status !== 'RINGING') {
          throw this.invalidTransition();
        }
        if (!call.offerForwardedAt) {
          const updated = await tx.callSession.update({
            where: { id: call.id },
            data: { offerForwardedAt: new Date(), version: { increment: 1 } }
          });
          await tx.callEvent.create({
            data: { callId, actorId, action: 'OFFER_FORWARDED' }
          });
          return { expired: false as const, call: updated as CallRecord, ended: false };
        }
        return { expired: false as const, call: call as CallRecord, ended: false };
      }

      if (action === 'ANSWER') {
        if (call.calleeId !== actorId) throw this.invalidTransition();
        if (call.status === 'ACTIVE') {
          return { expired: false as const, call: call as CallRecord, ended: false };
        }
        if (call.status !== 'RINGING' || !call.offerForwardedAt) {
          throw this.invalidTransition();
        }
        const updated = await tx.callSession.update({
          where: { id: call.id },
          data: {
            status: 'ACTIVE',
            answeredAt: new Date(),
            expiresAt: new Date('9999-12-31T23:59:59.999Z'),
            version: { increment: 1 }
          }
        });
        await tx.callEvent.create({
          data: { callId, actorId, action: 'CALL_ANSWERED' }
        });
        return { expired: false as const, call: updated as CallRecord, ended: false };
      }

      if (action === 'ICE') {
        if (!['RINGING', 'ACTIVE'].includes(call.status)) {
          throw this.invalidTransition();
        }
        return { expired: false as const, call: call as CallRecord, ended: false };
      }

      const ended = await this.endTx(tx, call as CallRecord, actorId, reason);
      return { expired: false as const, call: ended as CallRecord, ended: true };
    });

    if (result.expired) {
      await this.expireCall(callId, 'SIGNAL_AFTER_EXPIRY');
      throw new ConflictException({
        code: 'CALL_EXPIRED',
        message: 'Cet appel a expiré.'
      });
    }

    if (result.ended) {
      await this.audit.record({
        actorId,
        action: 'CALL_ENDED',
        entity: 'CallSession',
        entityId: callId,
        metadata: {
          status: result.call.status,
          reason: result.call.endReason,
          targetUserId
        }
      });
    }
    return {
      id: result.call.id,
      callerId: result.call.callerId,
      calleeId: result.call.calleeId,
      media: result.call.media === 'VIDEO' ? 'video' : 'audio',
      status: result.call.status,
      endReason: result.call.endReason,
      ended: result.ended
    };
  }

  async end(userId: string, callId: string, reason: string) {
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call) throw this.notFound();
    this.assertParticipant(call, userId);
    const targetUserId = call.callerId === userId ? call.calleeId : call.callerId;
    await this.authorizeSignal(userId, targetUserId, callId, 'END', reason);
    return this.view(userId, callId);
  }

  async expireDue(limit = 100) {
    const candidates = await this.prisma.callSession.findMany({
      where: { status: 'RINGING', expiresAt: { lte: new Date() } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: Math.min(500, Math.max(1, limit))
    });
    let missed = 0;
    for (const candidate of candidates) {
      if (await this.expireCall(candidate.id, 'RING_TIMEOUT')) missed += 1;
    }
    return { inspectedCalls: candidates.length, missedCalls: missed };
  }

  async exportForAccount(userId: string) {
    const calls = await this.prisma.callSession.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        callerId: true,
        calleeId: true,
        media: true,
        status: true,
        answeredAt: true,
        endedAt: true,
        endReason: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const authoredEvents = await this.prisma.callEvent.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: 'desc' },
      select: { callId: true, action: true, metadata: true, createdAt: true }
    });
    return {
      formatVersion: 1,
      sessionDescriptionsIncluded: false,
      iceCandidatesIncluded: false,
      networkAddressesIncluded: false,
      calls,
      authoredEvents
    };
  }

  async deleteForAccount(userId: string, tx: Tx) {
    const liveCalls = await tx.callSession.findMany({
      where: {
        status: { in: ['RINGING', 'ACTIVE'] },
        OR: [{ callerId: userId }, { calleeId: userId }]
      }
    });
    for (const call of liveCalls) {
      await tx.callSession.update({
        where: { id: call.id },
        data: {
          status: 'CANCELLED',
          endedAt: new Date(),
          endedById: userId,
          endReason: 'ACCOUNT_DELETED',
          version: { increment: 1 }
        }
      });
      await tx.callEvent.create({
        data: {
          callId: call.id,
          actorId: userId,
          action: 'CALL_CANCELLED_FOR_ACCOUNT_DELETION'
        }
      });
    }
    const tombstone = `deleted-${randomUUID()}`;
    await tx.callReceipt.deleteMany({ where: { userId } });
    await tx.callEvent.updateMany({
      where: { actorId: userId },
      data: { actorId: tombstone }
    });
    await tx.callSession.updateMany({
      where: { callerId: userId },
      data: { callerId: tombstone }
    });
    await tx.callSession.updateMany({
      where: { calleeId: userId },
      data: { calleeId: tombstone }
    });
    await tx.callSession.updateMany({
      where: { endedById: userId },
      data: { endedById: tombstone }
    });
  }

  private async expireCall(callId: string, source: string) {
    const call = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!call || call.status !== 'RINGING' || call.expiresAt > new Date()) {
      return false;
    }
    const changed = await this.serializable(async (tx) => {
      const current = await tx.callSession.findUnique({ where: { id: callId } });
      if (!current || current.status !== 'RINGING' || current.expiresAt > new Date()) {
        return false;
      }
      return this.markMissedTx(tx, current as CallRecord, source);
    });
    if (!changed) return false;
    await this.notifications.create({
      userId: call.calleeId,
      type: 'CALL_MISSED',
      title: 'Appel manqué',
      body:
        call.media === 'VIDEO'
          ? 'Tu as manqué un appel vidéo.'
          : 'Tu as manqué un appel audio.',
      data: {
        route: '/calls',
        entityType: 'CALL_SESSION',
        entityId: call.id,
        actorId: call.callerId
      }
    });
    return true;
  }

  private async endTx(
    tx: Tx,
    call: CallRecord,
    actorId: string,
    reason?: string
  ) {
    if (TERMINAL_STATUSES.includes(call.status)) return call;
    const normalized = reason?.toLowerCase();
    let status: 'ENDED' | 'REJECTED' | 'CANCELLED';
    let endReason: 'HANGUP' | 'REJECTED' | 'CANCELLED';
    if (
      call.status === 'RINGING' &&
      actorId === call.calleeId &&
      normalized === 'rejected'
    ) {
      status = 'REJECTED';
      endReason = 'REJECTED';
    } else if (call.status === 'RINGING') {
      status = 'CANCELLED';
      endReason = 'CANCELLED';
    } else {
      status = 'ENDED';
      endReason = 'HANGUP';
    }
    const updated = await tx.callSession.update({
      where: { id: call.id },
      data: {
        status,
        endedAt: new Date(),
        endedById: actorId,
        endReason,
        version: { increment: 1 }
      }
    });
    await tx.callEvent.create({
      data: {
        callId: call.id,
        actorId,
        action: `CALL_${status}`,
        metadata: this.json({ reason: endReason })
      }
    });
    return updated;
  }

  private async markMissedTx(tx: Tx, call: CallRecord, source: string) {
    const changed = await tx.callSession.updateMany({
      where: { id: call.id, status: 'RINGING', version: call.version },
      data: {
        status: 'MISSED',
        endedAt: new Date(),
        endReason: 'MISSED',
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) return false;
    await tx.callEvent.create({
      data: {
        callId: call.id,
        actorId: 'system:call-maintenance',
        action: 'CALL_MISSED',
        metadata: this.json({ source })
      }
    });
    return true;
  }

  private present(
    call: CallRecord,
    userId: string,
    peer: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null
  ) {
    return {
      id: call.id,
      direction: call.callerId === userId ? 'OUTGOING' : 'INCOMING',
      media: call.media === 'VIDEO' ? 'video' : 'audio',
      status: call.status,
      peer,
      offerForwardedAt: call.offerForwardedAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      endReason: call.endReason,
      expiresAt: call.status === 'RINGING' ? call.expiresAt : null,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
      policy: {
        serverIssuedCallId: true,
        sessionDescriptionsPersisted: false,
        iceCandidatesPersisted: false,
        sharedConversationRequired: true,
        oneLiveCallPerParticipant: true
      }
    };
  }

  private assertParticipant(
    call: { callerId: string; calleeId: string },
    userId: string
  ) {
    if (![call.callerId, call.calleeId].includes(userId)) {
      throw new ForbiddenException({
        code: 'CALL_PARTICIPANT_REQUIRED',
        message: 'Tu ne participes pas à cet appel.'
      });
    }
  }

  private assertSignalPair(
    call: CallRecord,
    actorId: string,
    targetUserId: string
  ) {
    this.assertParticipant(call, actorId);
    const expectedTarget =
      call.callerId === actorId ? call.calleeId : call.callerId;
    if (expectedTarget !== targetUserId) {
      throw new ForbiddenException({
        code: 'CALL_SIGNAL_TARGET_INVALID',
        message: 'La cible de signalisation ne correspond pas à cet appel.'
      });
    }
  }

  private async assertHourlyLimit(userId: string) {
    const count = await this.prisma.callSession.count({
      where: {
        callerId: userId,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1_000) }
      }
    });
    if (count >= MAX_CALLS_PER_HOUR) {
      throw new TooManyRequestsException({
        code: 'CALL_RATE_LIMITED',
        message: 'Trop d’appels ont été initiés récemment.'
      });
    }
  }

  private async serializable<T>(task: (tx: Tx) => Promise<T>) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(task, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code) &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException({
      code: 'CALL_CONFLICT',
      message: 'L’état de l’appel a changé. Réessaie.'
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private notFound() {
    return new NotFoundException({
      code: 'CALL_NOT_FOUND',
      message: 'Appel introuvable.'
    });
  }

  private invalidTransition() {
    return new ConflictException({
      code: 'CALL_TRANSITION_INVALID',
      message: 'Cette transition d’appel n’est pas autorisée.'
    });
  }
}
