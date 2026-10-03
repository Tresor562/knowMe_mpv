import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { E2EE_PROTOCOL } from './e2ee.domain';
import {
  CreateSecretConversationDto,
  SendSecretMessageDto
} from './secret-chat.dto';
import {
  assertOpaqueCiphertext,
  SECRET_CONVERSATION_MODE,
  secretChatServerPolicy
} from './secret-chat.domain';

@Injectable()
export class SecretChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway
  ) {}

  policy() {
    return secretChatServerPolicy();
  }

  async createConversation(
    userId: string,
    sessionId: string | undefined,
    dto: CreateSecretConversationDto
  ) {
    const currentDevice = await this.requireCurrentDevice(userId, sessionId);
    const memberIds = [...new Set([userId, ...dto.memberIds])];
    if (memberIds.length < 2 || memberIds.length > 32) {
      throw new BadRequestException('SECRET_CHAT_MEMBER_COUNT_INVALID');
    }

    const coverage = await this.activeDevicesForMembers(memberIds);
    this.assertEveryMemberCovered(memberIds, coverage);

    if (!coverage.some((device) => device.id === currentDevice.id)) {
      throw new UnauthorizedException('SECRET_CHAT_CURRENT_DEVICE_INACTIVE');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        title: dto.title?.trim() || null,
        isGroup: memberIds.length > 2,
        encryptionMode: SECRET_CONVERSATION_MODE,
        members: {
          create: memberIds.map((memberId) => ({ userId: memberId }))
        }
      },
      include: {
        members: {
          select: {
            userId: true,
            joinedAt: true
          }
        }
      }
    });

    await this.audit.record({
      actorId: userId,
      action: 'SECRET_CHAT_CREATE',
      entity: 'Conversation',
      entityId: conversation.id,
      targetAccountId: userId,
      metadata: {
        memberCount: memberIds.length,
        activeDeviceCount: coverage.length,
        protocol: E2EE_PROTOCOL
      }
    });

    return {
      ...conversation,
      protocol: E2EE_PROTOCOL,
      activeDeviceCount: coverage.length
    };
  }

  async send(
    userId: string,
    sessionId: string | undefined,
    conversationId: string,
    dto: SendSecretMessageDto
  ) {
    const senderDevice = await this.requireCurrentDevice(userId, sessionId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        encryptionMode: true,
        members: { select: { userId: true } }
      }
    });
    if (!conversation) throw new NotFoundException('SECRET_CHAT_NOT_FOUND');
    if (conversation.encryptionMode !== SECRET_CONVERSATION_MODE) {
      throw new ConflictException('SECRET_CHAT_MODE_REQUIRED');
    }

    const memberIds = conversation.members.map((member) => member.userId);
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('SECRET_CHAT_ACCESS_DENIED');
    }

    const devices = await this.activeDevicesForMembers(memberIds);
    this.assertEveryMemberCovered(memberIds, devices);

    const requiredDeviceIds = new Set(
      devices
        .filter((device) => device.id !== senderDevice.id)
        .map((device) => device.id)
    );

    const seen = new Set<string>();
    const envelopes = dto.envelopes.map((envelope) => {
      if (seen.has(envelope.recipientDeviceId)) {
        throw new BadRequestException('SECRET_CHAT_DUPLICATE_RECIPIENT_DEVICE');
      }
      seen.add(envelope.recipientDeviceId);
      return {
        recipientDeviceId: envelope.recipientDeviceId,
        messageKind: envelope.messageKind,
        ciphertext: assertOpaqueCiphertext(envelope.ciphertext)
      };
    });

    if (
      seen.size !== requiredDeviceIds.size ||
      [...seen].some((id) => !requiredDeviceIds.has(id))
    ) {
      throw new ConflictException({
        code: 'SECRET_CHAT_DEVICE_FANOUT_MISMATCH',
        expectedEnvelopeCount: requiredDeviceIds.size,
        providedEnvelopeCount: seen.size
      });
    }

    const existing = await this.prisma.secretMessage.findUnique({
      where: {
        senderDeviceId_clientMessageId: {
          senderDeviceId: senderDevice.id,
          clientMessageId: dto.clientMessageId
        }
      },
      select: {
        id: true,
        conversationId: true,
        protocol: true,
        createdAt: true
      }
    });
    if (existing) {
      if (
        existing.conversationId !== conversationId ||
        existing.protocol !== dto.protocol
      ) {
        throw new ConflictException('SECRET_CHAT_CLIENT_MESSAGE_ID_REUSED');
      }
      return { ...existing, replayed: true };
    }

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.secretMessage.create({
          data: {
            conversationId,
            senderUserId: userId,
            senderDeviceId: senderDevice.id,
            clientMessageId: dto.clientMessageId,
            protocol: dto.protocol,
            envelopes: {
              create: envelopes
            }
          },
          select: {
            id: true,
            conversationId: true,
            senderUserId: true,
            senderDeviceId: true,
            clientMessageId: true,
            protocol: true,
            createdAt: true
          }
        });

        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: message.createdAt }
        });
        return message;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.secretMessage.findUnique({
          where: {
            senderDeviceId_clientMessageId: {
              senderDeviceId: senderDevice.id,
              clientMessageId: dto.clientMessageId
            }
          },
          select: {
            id: true,
            conversationId: true,
            senderUserId: true,
            senderDeviceId: true,
            clientMessageId: true,
            protocol: true,
            createdAt: true
          }
        });
        if (replay && replay.conversationId === conversationId) {
          return { ...replay, replayed: true };
        }
      }
      throw error;
    }

    const recipientUserIds = [
      ...new Set(
        devices
          .filter((device) => requiredDeviceIds.has(device.id))
          .map((device) => device.userId)
      )
    ];
    this.realtime.emitSecretMessageAvailable(recipientUserIds, {
      conversationId,
      messageId: created.id,
      createdAt: created.createdAt
    });

    await this.audit.record({
      actorId: userId,
      action: 'SECRET_MESSAGE_SEND',
      entity: 'SecretMessage',
      entityId: created.id,
      targetAccountId: userId,
      metadata: {
        conversationId,
        senderDeviceId: senderDevice.id,
        protocol: dto.protocol,
        envelopeCount: envelopes.length
      }
    });

    return { ...created, replayed: false };
  }

  async inbox(
    userId: string,
    sessionId: string | undefined,
    cursor?: string,
    limit = 50
  ) {
    const device = await this.requireCurrentDevice(userId, sessionId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const cursorRow = cursor
      ? await this.prisma.secretMessageEnvelope.findFirst({
          where: { id: cursor, recipientDeviceId: device.id },
          select: { id: true, createdAt: true }
        })
      : null;
    if (cursor && !cursorRow) {
      throw new BadRequestException('SECRET_CHAT_INBOX_CURSOR_INVALID');
    }

    const rows = await this.prisma.secretMessageEnvelope.findMany({
      where: {
        recipientDeviceId: device.id,
        ...(cursorRow
          ? {
              OR: [
                { createdAt: { lt: cursorRow.createdAt } },
                { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } }
              ]
            }
          : {})
      },
      take: safeLimit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        message: {
          select: {
            id: true,
            conversationId: true,
            senderUserId: true,
            senderDeviceId: true,
            clientMessageId: true,
            protocol: true,
            createdAt: true
          }
        }
      }
    });

    const hasMore = rows.length > safeLimit;
    const page = rows.slice(0, safeLimit);
    return {
      deviceId: device.id,
      items: page.map((row) => ({
        envelopeId: row.id,
        messageKind: row.messageKind,
        ciphertext: row.ciphertext,
        deliveredAt: row.deliveredAt,
        readAt: row.readAt,
        ...row.message
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null
    };
  }

  async markDelivered(
    userId: string,
    sessionId: string | undefined,
    envelopeId: string
  ) {
    const device = await this.requireCurrentDevice(userId, sessionId);
    const now = new Date();
    const result = await this.prisma.secretMessageEnvelope.updateMany({
      where: {
        id: envelopeId,
        recipientDeviceId: device.id,
        deliveredAt: null
      },
      data: { deliveredAt: now }
    });
    if (!result.count) {
      const existing = await this.prisma.secretMessageEnvelope.findFirst({
        where: { id: envelopeId, recipientDeviceId: device.id },
        select: { deliveredAt: true }
      });
      if (!existing) throw new NotFoundException('SECRET_CHAT_ENVELOPE_NOT_FOUND');
      return { envelopeId, deliveredAt: existing.deliveredAt, replayed: true };
    }
    return { envelopeId, deliveredAt: now, replayed: false };
  }

  async markRead(
    userId: string,
    sessionId: string | undefined,
    envelopeId: string
  ) {
    const device = await this.requireCurrentDevice(userId, sessionId);
    const now = new Date();
    const result = await this.prisma.secretMessageEnvelope.updateMany({
      where: {
        id: envelopeId,
        recipientDeviceId: device.id,
        readAt: null
      },
      data: {
        deliveredAt: now,
        readAt: now
      }
    });
    if (!result.count) {
      const existing = await this.prisma.secretMessageEnvelope.findFirst({
        where: { id: envelopeId, recipientDeviceId: device.id },
        select: { deliveredAt: true, readAt: true }
      });
      if (!existing) throw new NotFoundException('SECRET_CHAT_ENVELOPE_NOT_FOUND');
      return {
        envelopeId,
        deliveredAt: existing.deliveredAt,
        readAt: existing.readAt,
        replayed: true
      };
    }
    return { envelopeId, deliveredAt: now, readAt: now, replayed: false };
  }

  private async requireCurrentDevice(
    userId: string,
    sessionId: string | undefined
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('SECRET_CHAT_AUTH_SESSION_REQUIRED');
    }
    const device = await this.prisma.e2eeDevice.findFirst({
      where: {
        userId,
        sessionId,
        protocol: E2EE_PROTOCOL,
        revokedAt: null,
        session: {
          revokedAt: null,
          expiresAt: { gt: new Date() }
        }
      },
      select: { id: true, userId: true, sessionId: true }
    });
    if (!device) {
      throw new UnauthorizedException('SECRET_CHAT_E2EE_DEVICE_REQUIRED');
    }
    return device;
  }

  private async activeDevicesForMembers(memberIds: string[]) {
    return this.prisma.e2eeDevice.findMany({
      where: {
        userId: { in: memberIds },
        protocol: E2EE_PROTOCOL,
        revokedAt: null,
        session: {
          revokedAt: null,
          expiresAt: { gt: new Date() }
        }
      },
      select: {
        id: true,
        userId: true,
        sessionId: true
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
    });
  }

  private assertEveryMemberCovered(
    memberIds: string[],
    devices: Array<{ userId: string }>
  ) {
    const covered = new Set(devices.map((device) => device.userId));
    if (memberIds.some((memberId) => !covered.has(memberId))) {
      throw new ConflictException('SECRET_CHAT_MEMBER_WITHOUT_ACTIVE_E2EE_DEVICE');
    }
  }
}
