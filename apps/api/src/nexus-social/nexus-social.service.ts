import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type NexusMode = 'instant' | 'think';
type InvokeInput = {
  sourceMessageId?: unknown;
  idempotencyKey?: unknown;
  mode?: unknown;
};

type NexusBridgeResult = {
  envelope?: {
    requestId?: unknown;
    conversationId?: unknown;
    surface?: unknown;
    reply?: unknown;
    generatedAt?: unknown;
    deliveryAuthorized?: unknown;
  };
  provider?: unknown;
  model?: unknown;
  route?: unknown;
  fallbackUsed?: unknown;
  error?: unknown;
};

const NEXUS_AUTHOR = {
  id: 'nexus.ai',
  username: 'nexus_ai',
  displayName: 'Nexus',
  avatarUrl: null
} as const;
const MENTION = /(^|\s)@nexus\b/i;
const MAX_CONTEXT_MESSAGES = 30;
const MAX_MEMBERS = 99;
const MAX_REPLY_CHARS = 30_000;

@Injectable()
export class NexusSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  status() {
    return {
      enabled: this.enabled(),
      version: 'knowme-nexus-social-v1',
      privateConversation: true,
      groupInvocation: 'explicit-mention-only',
      hiddenListening: false,
      maxContextMessages: MAX_CONTEXT_MESSAGES
    };
  }

  async createPrivateConversation(userId: string) {
    this.assertEnabled();
    const existing = await this.prisma.nexusSocialConversation.findUnique({
      where: { ownerUserId: userId }
    });
    if (existing) {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: existing.conversationId,
          members: { some: { userId } }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      });
      if (conversation) return { ...conversation, nexusSurface: 'private' as const };
      await this.prisma.nexusSocialConversation.delete({ where: { id: existing.id } });
    }

    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          title: 'Nexus',
          isGroup: false,
          members: { create: [{ userId }] }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      });
      await tx.nexusSocialConversation.create({
        data: { conversationId: created.id, ownerUserId: userId }
      });
      return created;
    });

    await this.audit.record({
      actorId: userId,
      action: 'NEXUS_SOCIAL_PRIVATE_CONVERSATION_CREATE',
      entity: 'CONVERSATION',
      entityId: conversation.id,
      targetAccountId: userId,
      metadata: { surface: 'private' }
    });
    return { ...conversation, nexusSurface: 'private' as const };
  }

  async listReplies(userId: string, conversationId: string, limit = 50) {
    await this.assertMember(userId, conversationId);
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 100);
    const rows = await this.prisma.nexusSocialReply.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: safeLimit
    });
    return { items: rows.map((row) => this.presentReply(row)) };
  }

  async invoke(userId: string, conversationId: string, input: InvokeInput) {
    this.assertEnabled();
    const sourceMessageId = this.text(input.sourceMessageId, 200);
    const idempotencyKey = this.text(input.idempotencyKey, 160);
    const mode: NexusMode = input.mode === 'think' ? 'think' : 'instant';
    if (!sourceMessageId) throw new BadRequestException('sourceMessageId is required.');
    if (!/^[A-Za-z0-9_.:-]{16,160}$/.test(idempotencyKey)) {
      throw new BadRequestException('A stable idempotencyKey of 16-160 characters is required.');
    }

    const [keyReplay, sourceReplay] = await Promise.all([
      this.prisma.nexusSocialReply.findUnique({
        where: { conversationId_idempotencyKey: { conversationId, idempotencyKey } }
      }),
      this.prisma.nexusSocialReply.findUnique({
        where: { conversationId_sourceMessageId: { conversationId, sourceMessageId } }
      })
    ]);
    const replay = keyReplay ?? sourceReplay;
    if (replay) return this.presentReply(replay);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        }
      }
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (!conversation.members.some((member) => member.userId === userId)) {
      throw new ForbiddenException('Conversation membership required.');
    }
    if (conversation.members.length > MAX_MEMBERS) {
      throw new BadRequestException(`Nexus group context supports at most ${MAX_MEMBERS} human members.`);
    }

    const nexusPrivate = await this.prisma.nexusSocialConversation.findUnique({
      where: { conversationId }
    });
    const surface = nexusPrivate ? 'private' as const : 'group' as const;
    if (nexusPrivate && nexusPrivate.ownerUserId !== userId) {
      throw new ForbiddenException('This private Nexus conversation belongs to another user.');
    }
    if (!nexusPrivate && !conversation.isGroup) {
      throw new BadRequestException('Nexus direct replies are only available in an explicit private Nexus conversation.');
    }

    const source = await this.prisma.message.findFirst({
      where: { id: sourceMessageId, conversationId },
      select: { id: true, senderId: true, content: true, createdAt: true }
    });
    if (!source) throw new NotFoundException('Invocation source message not found.');
    if (source.senderId !== userId) {
      throw new ForbiddenException('Only the author of the current message can invoke Nexus for that turn.');
    }
    if (!nexusPrivate && !MENTION.test(source.content)) {
      throw new BadRequestException('Group Nexus replies require an explicit @Nexus mention in the source message.');
    }

    const [laterHuman, laterNexus] = await Promise.all([
      this.prisma.message.findFirst({
        where: { conversationId, createdAt: { gt: source.createdAt } },
        select: { id: true }
      }),
      this.prisma.nexusSocialReply.findFirst({
        where: { conversationId, createdAt: { gt: source.createdAt } },
        select: { id: true }
      })
    ]);
    if (laterHuman || laterNexus) {
      throw new ConflictException('This Nexus invocation is stale. Invoke Nexus again from the current turn.');
    }

    const requestId = `ksocial-${randomUUID()}`;
    const bridgeRequest = await this.buildBridgeRequest({
      conversation,
      conversationId,
      invokingUserId: userId,
      requestId,
      surface,
      invocationKind: nexusPrivate ? 'direct' : 'mention'
    });
    const bridge = await this.callNexus(mode, bridgeRequest);
    const envelope = bridge.envelope;
    if (
      !envelope ||
      envelope.requestId !== requestId ||
      envelope.conversationId !== conversationId ||
      envelope.surface !== surface ||
      envelope.deliveryAuthorized !== false ||
      typeof envelope.reply !== 'string' ||
      !envelope.reply.trim()
    ) {
      throw new BadGatewayException('Nexus returned an invalid social reply envelope.');
    }

    const replyText = envelope.reply.trim().slice(0, MAX_REPLY_CHARS);
    const stored = await this.prisma.$transaction(async (tx) => {
      const created = await tx.nexusSocialReply.create({
        data: {
          requestId,
          idempotencyKey,
          conversationId,
          invokingUserId: userId,
          sourceMessageId,
          surface,
          invocationKind: nexusPrivate ? 'direct' : 'mention',
          content: replyText,
          provider: this.text(bridge.provider, 120) || null,
          model: this.text(bridge.model, 200) || null,
          route: this.text(bridge.route, 200) || null,
          fallbackUsed: bridge.fallbackUsed === true
        }
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: created.createdAt }
      });
      return created;
    });

    const presented = this.presentReply(stored);
    const recipients = conversation.members
      .map((member) => member.userId)
      .filter((memberId) => memberId !== userId);
    await Promise.all([
      this.realtime.emitMessageCreated(conversationId, presented),
      recipients.length
        ? this.notifications.createMany(recipients.map((recipientId) => ({
            userId: recipientId,
            type: 'MESSAGE',
            title: 'Nexus a répondu',
            body: replyText.length > 120 ? `${replyText.slice(0, 117)}…` : replyText,
            data: {
              route: `/messages/${conversationId}`,
              entityType: 'CONVERSATION',
              entityId: conversationId,
              nexusAuthored: true
            }
          })))
        : Promise.resolve([]),
      this.audit.record({
        actorId: userId,
        action: 'NEXUS_SOCIAL_REPLY_DELIVER',
        entity: 'CONVERSATION',
        entityId: conversationId,
        targetAccountId: userId,
        metadata: {
          requestId,
          sourceMessageId,
          surface,
          mode,
          provider: stored.provider,
          model: stored.model,
          route: stored.route
        }
      })
    ]);
    return presented;
  }

  private async buildBridgeRequest(input: {
    conversation: {
      members: Array<{ userId: string; user: { displayName: string } }>;
    };
    conversationId: string;
    invokingUserId: string;
    requestId: string;
    surface: 'private' | 'group';
    invocationKind: 'direct' | 'mention';
  }) {
    const [humanRows, nexusRows] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: input.conversationId },
        include: {
          sender: { select: { id: true, displayName: true } }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_CONTEXT_MESSAGES
      }),
      this.prisma.nexusSocialReply.findMany({
        where: { conversationId: input.conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_CONTEXT_MESSAGES
      })
    ]);

    const combined = [
      ...humanRows.map((message) => ({
        id: message.id,
        authorId: message.senderId,
        content: message.content.slice(0, 12_000),
        createdAt: message.createdAt.toISOString(),
        nexusAuthored: false
      })),
      ...nexusRows.map((message) => ({
        id: message.id,
        authorId: NEXUS_AUTHOR.id,
        content: message.content.slice(0, 12_000),
        createdAt: message.createdAt.toISOString(),
        nexusAuthored: true
      }))
    ]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-MAX_CONTEXT_MESSAGES);

    const participants = [
      ...input.conversation.members.map((member) => ({
        id: member.userId,
        displayName: member.user.displayName,
        role: 'member' as const
      })),
      { id: NEXUS_AUTHOR.id, displayName: NEXUS_AUTHOR.displayName, role: 'member' as const }
    ];

    return {
      requestId: input.requestId,
      conversationId: input.conversationId,
      surface: input.surface,
      invokingUserId: input.invokingUserId,
      participants,
      messages: combined,
      invocation: {
        explicit: true,
        kind: input.invocationKind,
        token: input.invocationKind === 'mention' ? '@Nexus' : undefined
      }
    };
  }

  private async callNexus(mode: NexusMode, request: Record<string, unknown>) {
    const endpoint = this.nexusEndpoint();
    const secret = process.env.NEXUS_KNOWME_SHARED_SECRET?.trim() ?? '';
    if (secret.length < 32) throw new ServiceUnavailableException('Nexus shared secret is not configured.');
    const timeout = this.boundedInteger(process.env.NEXUS_SOCIAL_TIMEOUT_MS, 20_000, 3_000, 30_000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'social.reply', mode, request }),
        signal: AbortSignal.timeout(timeout)
      });
    } catch (error) {
      throw new BadGatewayException(error instanceof Error ? `Nexus social request failed: ${error.message}` : 'Nexus social request failed.');
    }
    const payload = await response.json().catch(() => ({})) as NexusBridgeResult;
    if (!response.ok) {
      const detail = typeof payload.error === 'string' ? payload.error.slice(0, 500) : `Nexus returned HTTP ${response.status}.`;
      throw new BadGatewayException(detail);
    }
    return payload;
  }

  private nexusEndpoint() {
    const configured = process.env.NEXUS_SERVER_URL?.trim() ?? '';
    if (!configured) throw new ServiceUnavailableException('NEXUS_SERVER_URL is not configured.');
    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL is invalid.');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL must not contain credentials, query parameters or fragments.');
    }
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL must use HTTPS in production.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL must use HTTP(S).');
    }
    return new URL('/api/integrations/knowme', `${url.origin}/`).toString();
  }

  private presentReply(row: {
    id: string;
    conversationId: string;
    content: string;
    createdAt: Date;
    requestId: string;
    surface: string;
    provider: string | null;
    model: string | null;
    route: string | null;
  }) {
    return {
      id: `nexus:${row.id}`,
      sourceId: row.id,
      conversationId: row.conversationId,
      content: row.content,
      createdAt: row.createdAt,
      editedAt: null,
      senderId: NEXUS_AUTHOR.id,
      sender: NEXUS_AUTHOR,
      nexusAuthored: true,
      nexus: {
        requestId: row.requestId,
        surface: row.surface,
        provider: row.provider,
        model: row.model,
        route: row.route
      },
      presentation: { kind: 'TEXT' as const, text: row.content }
    };
  }

  private async assertMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!member) throw new ForbiddenException('Conversation membership required.');
  }

  private assertEnabled() {
    if (!this.enabled()) {
      throw new ServiceUnavailableException({
        code: 'NEXUS_SOCIAL_DISABLED',
        message: 'Nexus Social is disabled by the KnowMe kill switch.'
      });
    }
  }

  private enabled() {
    return process.env.NEXUS_INTEGRATION_ENABLED === 'true' && process.env.NEXUS_SOCIAL_ENABLED === 'true';
  }

  private text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  private boundedInteger(raw: string | undefined, fallback: number, min: number, max: number) {
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }
}
