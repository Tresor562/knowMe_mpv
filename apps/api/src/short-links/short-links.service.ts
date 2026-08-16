import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShortLinkDto } from './short-links.dto';
import {
  assertShortLinkTargetType,
  buildShortLinkDestination,
  normalizeShortCode,
  normalizeTargetId,
  ShortLinkTargetType
} from './short-links.domain';

const CREATION_FLAG = 'short_links.creation';
const MAX_EXPIRY_MS = 365 * 24 * 60 * 60 * 1_000;
const MAX_CODE_ATTEMPTS = 5;

type ShortLinkResponse = {
  id: string;
  code: string;
  shortPath: string;
  targetType: ShortLinkTargetType;
  targetId: string;
  webPath: string;
  deepLink: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

@Injectable()
export class ShortLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly audit: AuditService
  ) {}

  async create(ownerId: string, dto: CreateShortLinkDto) {
    const replay = await this.readReceipt(ownerId, dto.idempotencyKey, 'CREATE');
    if (replay) return replay;

    const enabled = await this.featureFlags.evaluate(CREATION_FLAG, { userId: ownerId });
    if (!enabled) {
      throw new ForbiddenException('La création de liens courts n’est pas activée.');
    }

    const targetType = assertShortLinkTargetType(dto.targetType);
    const targetId = normalizeTargetId(dto.targetId);
    const expiresAt = this.parseExpiry(dto.expiresAt);
    await this.authorizeTarget(ownerId, targetType, targetId);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = randomBytes(12).toString('base64url');
      try {
        const response = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.shortLinkReceipt.findUnique({
            where: {
              ownerId_idempotencyKey: {
                ownerId,
                idempotencyKey: dto.idempotencyKey
              }
            }
          });
          if (existing) {
            if (existing.operation !== 'CREATE') {
              throw new ConflictException('Clé d’idempotence déjà utilisée.');
            }
            return existing.response as unknown as ShortLinkResponse;
          }

          const link = await tx.shortLink.create({
            data: { code, ownerId, targetType, targetId, expiresAt }
          });
          const publicLink = this.serialize(link);
          await tx.shortLinkReceipt.create({
            data: {
              ownerId,
              idempotencyKey: dto.idempotencyKey,
              operation: 'CREATE',
              response: publicLink as unknown as Prisma.InputJsonValue
            }
          });
          return publicLink;
        });

        await this.audit.record({
          actorId: ownerId,
          action: 'SHORT_LINK_CREATE',
          entity: 'ShortLink',
          entityId: response.id,
          metadata: {
            targetType,
            expiresAt: response.expiresAt,
            arbitraryExternalUrl: false
          }
        });
        return response;
      } catch (error) {
        if (this.isUniqueConflict(error)) continue;
        throw error;
      }
    }

    throw new ConflictException('Impossible de générer un code court unique.');
  }

  async resolve(codeValue: string) {
    const code = normalizeShortCode(codeValue);
    const link = await this.prisma.shortLink.findUnique({ where: { code } });
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) {
      throw new NotFoundException('Lien indisponible.');
    }

    const updated = await this.prisma.shortLink.update({
      where: { id: link.id },
      data: {
        resolveCount: { increment: 1 },
        lastResolvedAt: new Date()
      }
    });
    return this.serialize(updated);
  }

  async mine(ownerId: string) {
    const links = await this.prisma.shortLink.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200
    });
    return links.map((link) => ({
      ...this.serialize(link),
      resolveCount: link.resolveCount,
      lastResolvedAt: link.lastResolvedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString()
    }));
  }

  async revoke(ownerId: string, id: string, idempotencyKey: string) {
    const replay = await this.readReceipt(ownerId, idempotencyKey, 'REVOKE');
    if (replay) return replay;

    const link = await this.prisma.shortLink.findFirst({ where: { id, ownerId } });
    if (!link) throw new NotFoundException('Lien introuvable.');

    const response = await this.prisma.$transaction(async (tx) => {
      const updated = link.revokedAt
        ? link
        : await tx.shortLink.update({
            where: { id: link.id },
            data: { revokedAt: new Date() }
          });
      const publicLink = this.serialize(updated);
      await tx.shortLinkReceipt.create({
        data: {
          ownerId,
          idempotencyKey,
          operation: 'REVOKE',
          response: publicLink as unknown as Prisma.InputJsonValue
        }
      });
      return publicLink;
    });

    await this.audit.record({
      actorId: ownerId,
      action: 'SHORT_LINK_REVOKE',
      entity: 'ShortLink',
      entityId: id
    });
    return response;
  }

  exportForAccount(ownerId: string) {
    return this.prisma.shortLink.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }

  async deleteForAccount(ownerId: string, tx: Prisma.TransactionClient = this.prisma) {
    await tx.shortLinkReceipt.deleteMany({ where: { ownerId } });
    await tx.shortLink.deleteMany({ where: { ownerId } });
  }

  private async readReceipt(ownerId: string, idempotencyKey: string, operation: string) {
    const receipt = await this.prisma.shortLinkReceipt.findUnique({
      where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } }
    });
    if (!receipt) return null;
    if (receipt.operation !== operation) {
      throw new ConflictException('Clé d’idempotence déjà utilisée.');
    }
    return receipt.response as unknown as ShortLinkResponse;
  }

  private parseExpiry(value?: string) {
    if (!value) return null;
    const expiresAt = new Date(value);
    const delta = expiresAt.getTime() - Date.now();
    if (!Number.isFinite(expiresAt.getTime()) || delta <= 0 || delta > MAX_EXPIRY_MS) {
      throw new ConflictException('Expiration de lien invalide.');
    }
    return expiresAt;
  }

  private async authorizeTarget(
    ownerId: string,
    targetType: ShortLinkTargetType,
    targetId: string
  ) {
    if (targetType === 'PROFILE') {
      const profile = await this.prisma.user.findFirst({
        where: { OR: [{ id: targetId }, { username: targetId }] },
        select: { id: true }
      });
      if (!profile) throw new NotFoundException('Destination introuvable.');
      return;
    }

    if (targetType === 'CHALLENGE') {
      const challenge = await this.prisma.challenge.findUnique({
        where: { id: targetId },
        select: { creatorId: true, visibility: true, status: true }
      });
      if (!challenge) throw new NotFoundException('Destination introuvable.');
      if (challenge.creatorId === ownerId) return;
      if (challenge.visibility === 'PUBLIC' && challenge.status === 'ACTIVE') return;
      const participant = await this.prisma.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId: targetId, userId: ownerId } },
        select: { id: true }
      });
      if (!participant) throw new ForbiddenException('Destination non partageable.');
      return;
    }

    if (targetType === 'GROUP') {
      const membership = await this.prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: targetId, userId: ownerId } },
        include: { conversation: { select: { isGroup: true } } }
      });
      if (!membership?.conversation.isGroup) {
        throw new ForbiddenException('Destination non partageable.');
      }
      return;
    }

    if (targetType === 'COMMUNITY') {
      const circle = await this.prisma.profileCircle.findFirst({
        where: { OR: [{ id: targetId }, { slug: targetId }] },
        select: { id: true, ownerUserId: true, visibility: true, status: true }
      });
      if (!circle) throw new NotFoundException('Destination introuvable.');
      if (circle.ownerUserId === ownerId) return;
      if (circle.visibility === 'PUBLIC' && circle.status === 'ACTIVE') return;
      const member = await this.prisma.profileCircleMember.findFirst({
        where: { circleId: circle.id, userId: ownerId, status: 'ACTIVE' },
        select: { id: true }
      });
      if (!member) throw new ForbiddenException('Destination non partageable.');
      return;
    }

    if (targetType === 'GIFT') {
      const gift = await this.prisma.notification.findFirst({
        where: { id: targetId, userId: ownerId, type: 'SOCIAL_GIFT' },
        select: { id: true }
      });
      if (!gift) throw new ForbiddenException('Destination non partageable.');
      return;
    }

    throw new ForbiddenException('Ce type de destination n’est pas encore partageable.');
  }

  private serialize(link: {
    id: string;
    code: string;
    targetType: string;
    targetId: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
  }): ShortLinkResponse {
    const targetType = assertShortLinkTargetType(link.targetType);
    const destination = buildShortLinkDestination(targetType, link.targetId);
    return {
      id: link.id,
      code: link.code,
      shortPath: `/s/${link.code}`,
      targetType,
      targetId: link.targetId,
      ...destination,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      revokedAt: link.revokedAt?.toISOString() ?? null
    };
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
