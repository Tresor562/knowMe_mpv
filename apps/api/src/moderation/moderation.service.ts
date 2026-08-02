import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyModerationActionDto } from './dto/apply-moderation-action.dto';

export type ModeratedAction =
  | 'MESSAGE_SEND'
  | 'POST_CREATE'
  | 'COMMENT_CREATE'
  | 'REPORT_CREATE';

type ModerationCheck = {
  actorId: string;
  action: ModeratedAction;
  content?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

type AbusePolicy = {
  windowMs: number;
  maxActions: number;
  duplicateWindowMs: number;
  maxDuplicates: number;
};

const POLICIES: Record<ModeratedAction, AbusePolicy> = {
  MESSAGE_SEND: {
    windowMs: 60_000,
    maxActions: 20,
    duplicateWindowMs: 10 * 60_000,
    maxDuplicates: 3
  },
  POST_CREATE: {
    windowMs: 10 * 60_000,
    maxActions: 5,
    duplicateWindowMs: 24 * 60 * 60_000,
    maxDuplicates: 1
  },
  COMMENT_CREATE: {
    windowMs: 5 * 60_000,
    maxActions: 12,
    duplicateWindowMs: 60 * 60_000,
    maxDuplicates: 3
  },
  REPORT_CREATE: {
    windowMs: 60 * 60_000,
    maxActions: 8,
    duplicateWindowMs: 24 * 60 * 60_000,
    maxDuplicates: 1
  }
};

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async assertAllowed(input: ModerationCheck) {
    const now = new Date();
    const policy = POLICIES[input.action];
    const normalizedContent = this.normalize(input.content);
    const contentHash = normalizedContent
      ? createHash('sha256').update(normalizedContent).digest('hex')
      : null;

    const activeActions = await this.prisma.moderationAction.findMany({
      where: {
        targetType: 'USER',
        targetId: input.actorId,
        reversedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      select: { action: true }
    });

    if (activeActions.some((item) => item.action === 'CONTENT_LOCK')) {
      await this.record(input, contentHash, 'BLOCKED', 'CONTENT_LOCK');
      throw new ForbiddenException(
        'La création de contenu est temporairement bloquée sur ce compte.'
      );
    }

    const isRestricted = activeActions.some(
      (item) => item.action === 'RATE_LIMIT'
    );
    const maxActions = isRestricted
      ? Math.max(1, Math.floor(policy.maxActions / 2))
      : policy.maxActions;

    const recentAllowed = await this.prisma.abuseEvent.count({
      where: {
        actorId: input.actorId,
        action: input.action,
        decision: 'ALLOWED',
        createdAt: { gte: new Date(now.getTime() - policy.windowMs) }
      }
    });

    if (recentAllowed >= maxActions) {
      await this.record(input, contentHash, 'BLOCKED', 'RATE_LIMIT');
      throw new HttpException(
        'Trop d’actions rapprochées. Réessaie plus tard.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (contentHash) {
      const duplicateCount = await this.prisma.abuseEvent.count({
        where: {
          actorId: input.actorId,
          action: input.action,
          contentHash,
          decision: 'ALLOWED',
          createdAt: {
            gte: new Date(now.getTime() - policy.duplicateWindowMs)
          }
        }
      });

      if (duplicateCount >= policy.maxDuplicates) {
        await this.record(input, contentHash, 'BLOCKED', 'DUPLICATE_CONTENT');
        throw new HttpException(
          'Ce contenu a déjà été publié trop récemment.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    return this.record(input, contentHash, 'ALLOWED');
  }

  listEvents(actorId?: string, decision?: string) {
    return this.prisma.abuseEvent.findMany({
      where: {
        ...(actorId ? { actorId } : {}),
        ...(decision ? { decision: decision.toUpperCase() } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  listActions(targetId?: string) {
    return this.prisma.moderationAction.findMany({
      where: targetId ? { targetId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async applyAction(actorId: string, dto: ApplyModerationActionDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.targetId },
      select: { id: true }
    });
    if (!target) throw new NotFoundException('Utilisateur ciblé introuvable.');

    const now = new Date();
    const existing = await this.prisma.moderationAction.findFirst({
      where: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        action: dto.action,
        reversedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      }
    });
    if (existing) {
      throw new ConflictException('Une mesure identique est déjà active.');
    }

    const action = await this.prisma.moderationAction.create({
      data: {
        actorId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        action: dto.action,
        reason: dto.reason.trim(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null
      }
    });

    await this.audit.record({
      actorId,
      action: 'MODERATION_ACTION_APPLY',
      entity: 'ModerationAction',
      entityId: action.id,
      targetAccountId: dto.targetId,
      metadata: {
        moderationAction: dto.action,
        expiresAt: action.expiresAt?.toISOString() ?? null
      }
    });

    return action;
  }

  async reverseAction(actorId: string, actionId: string) {
    const action = await this.prisma.moderationAction.findUnique({
      where: { id: actionId }
    });
    if (!action) throw new NotFoundException('Mesure de modération introuvable.');
    if (action.reversedAt) {
      throw new ConflictException('Cette mesure est déjà annulée.');
    }

    const reversed = await this.prisma.moderationAction.update({
      where: { id: actionId },
      data: { reversedAt: new Date(), reversedById: actorId }
    });

    await this.audit.record({
      actorId,
      action: 'MODERATION_ACTION_REVERSE',
      entity: 'ModerationAction',
      entityId: actionId,
      targetAccountId: action.targetId,
      metadata: { moderationAction: action.action }
    });

    return reversed;
  }

  private record(
    input: ModerationCheck,
    contentHash: string | null,
    decision: 'ALLOWED' | 'BLOCKED',
    reasonCode?: string
  ) {
    return this.prisma.abuseEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        contentHash,
        targetId: input.targetId?.trim() || null,
        decision,
        reasonCode: reasonCode ?? null,
        metadata: input.metadata
      }
    });
  }

  private normalize(content?: string) {
    return content?.trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ') ?? '';
  }
}
