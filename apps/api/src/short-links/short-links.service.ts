import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { KnowMeDeepLinkKind } from '@knowme/link-contract';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { findSticker, stickerCatalog } from '../messaging/stickers/sticker-catalog';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShortLinkDto } from './short-links.dto';
import {
  assertShortLinkKind,
  buildShortLinkDestination,
  normalizeShortCode,
  normalizeTargetId,
  shortLinkPolicy
} from './short-links.domain';

const CREATION_FLAG = 'short_links.creation';
const MAX_EXPIRY_MS = 365 * 24 * 60 * 60 * 1_000;
const MAX_CODE_ATTEMPTS = 5;

type ShortLinkLifecycleDatabase = Pick<
  Prisma.TransactionClient,
  'shortLink' | 'shortLinkReceipt'
>;

type OwnerShortLink = {
  id: string;
  code: string;
  shortPath: string;
  kind: KnowMeDeepLinkKind;
  targetId: string;
  universalPath: string;
  deepLink: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

type AvailableLink = {
  id: string;
  code: string;
  ownerId: string;
  kind: KnowMeDeepLinkKind;
  targetId: string;
  expiresAt: Date | null;
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

    const kind = assertShortLinkKind(dto.kind);
    const requestedTargetId = normalizeTargetId(dto.targetId);
    const expiresAt = this.parseExpiry(dto.expiresAt);
    const targetId = await this.authorizeTarget(ownerId, kind, requestedTargetId);

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
            return existing.response as unknown as OwnerShortLink;
          }

          const link = await tx.shortLink.create({
            data: { code, ownerId, targetKind: kind, targetId, expiresAt }
          });
          const ownerLink = this.serialize(link);
          await tx.shortLinkReceipt.create({
            data: {
              ownerId,
              idempotencyKey: dto.idempotencyKey,
              operation: 'CREATE',
              response: ownerLink as unknown as Prisma.InputJsonValue
            }
          });
          return ownerLink;
        });

        await this.audit.record({
          actorId: ownerId,
          action: 'SHORT_LINK_CREATE',
          entity: 'ShortLink',
          entityId: response.id,
          metadata: {
            kind,
            expiresAt: response.expiresAt,
            arbitraryExternalUrl: false,
            contractVersion: 'v1'
          }
        });
        return response;
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const replayAfterConflict = await this.readReceipt(
            ownerId,
            dto.idempotencyKey,
            'CREATE'
          );
          if (replayAfterConflict) return replayAfterConflict;
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Impossible de générer un code court unique.');
  }

  async preview(codeValue: string) {
    const link = await this.availableLink(codeValue);
    return {
      code: link.code,
      kind: link.kind,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      policy: {
        internalKnowMeDestinationOnly: true,
        arbitraryExternalUrlsAllowed: false,
        targetIdExposedBeforeContinuation: false,
        authorizationRevalidated: true,
        contractVersion: 'v1'
      }
    };
  }

  async resolve(codeValue: string) {
    const link = await this.availableLink(codeValue);
    const destination = buildShortLinkDestination(link.kind, link.targetId);
    const updated = await this.prisma.shortLink.update({
      where: { id: link.id },
      data: {
        resolveCount: { increment: 1 },
        lastResolvedAt: new Date()
      }
    });

    return {
      code: updated.code,
      kind: link.kind,
      ...destination,
      expiresAt: updated.expiresAt?.toISOString() ?? null
    };
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

    try {
      const response = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.shortLinkReceipt.findUnique({
          where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } }
        });
        if (existing) {
          if (existing.operation !== 'REVOKE') {
            throw new ConflictException('Clé d’idempotence déjà utilisée.');
          }
          return existing.response as unknown as OwnerShortLink;
        }

        const updated = link.revokedAt
          ? link
          : await tx.shortLink.update({
              where: { id: link.id },
              data: { revokedAt: new Date() }
            });
        const ownerLink = this.serialize(updated);
        await tx.shortLinkReceipt.create({
          data: {
            ownerId,
            idempotencyKey,
            operation: 'REVOKE',
            response: ownerLink as unknown as Prisma.InputJsonValue
          }
        });
        return ownerLink;
      });

      await this.audit.record({
        actorId: ownerId,
        action: 'SHORT_LINK_REVOKE',
        entity: 'ShortLink',
        entityId: id
      });
      return response;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const concurrentReplay = await this.readReceipt(ownerId, idempotencyKey, 'REVOKE');
        if (concurrentReplay) return concurrentReplay;
      }
      throw error;
    }
  }

  exportForAccount(ownerId: string) {
    return this.prisma.shortLink.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }

  async deleteForAccount(
    ownerId: string,
    tx: ShortLinkLifecycleDatabase = this.prisma
  ) {
    await tx.shortLinkReceipt.deleteMany({ where: { ownerId } });
    await tx.shortLink.deleteMany({ where: { ownerId } });
  }

  private async availableLink(codeValue: string): Promise<AvailableLink> {
    const code = normalizeShortCode(codeValue);
    const link = await this.prisma.shortLink.findUnique({ where: { code } });
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) {
      throw this.unavailable();
    }

    const kind = assertShortLinkKind(link.targetKind);
    try {
      const canonicalTargetId = await this.authorizeTarget(
        link.ownerId,
        kind,
        link.targetId
      );
      if (canonicalTargetId !== link.targetId) throw this.unavailable();
    } catch {
      throw this.unavailable();
    }

    return {
      id: link.id,
      code: link.code,
      ownerId: link.ownerId,
      kind,
      targetId: link.targetId,
      expiresAt: link.expiresAt
    };
  }

  private async readReceipt(ownerId: string, idempotencyKey: string, operation: string) {
    const receipt = await this.prisma.shortLinkReceipt.findUnique({
      where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } }
    });
    if (!receipt) return null;
    if (receipt.operation !== operation) {
      throw new ConflictException('Clé d’idempotence déjà utilisée.');
    }
    return receipt.response as unknown as OwnerShortLink;
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
    kind: KnowMeDeepLinkKind,
    targetId: string
  ): Promise<string> {
    if (kind === 'profile') {
      const profile = await this.prisma.user.findFirst({
        where: { OR: [{ id: targetId }, { username: targetId }] },
        select: { username: true }
      });
      if (!profile) throw new NotFoundException('Destination introuvable.');
      return normalizeTargetId(profile.username);
    }

    if (kind === 'challenge') {
      const challenge = await this.prisma.challenge.findUnique({
        where: { id: targetId },
        select: { id: true, creatorId: true, visibility: true, status: true }
      });
      if (!challenge) throw new NotFoundException('Destination introuvable.');
      if (challenge.creatorId === ownerId) return challenge.id;
      if (challenge.visibility === 'PUBLIC' && challenge.status === 'ACTIVE') {
        return challenge.id;
      }
      const participant = await this.prisma.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId: targetId, userId: ownerId } },
        select: { id: true }
      });
      if (!participant) throw new ForbiddenException('Destination non partageable.');
      return challenge.id;
    }

    if (kind === 'community') {
      const circle = await this.prisma.profileCircle.findFirst({
        where: { OR: [{ id: targetId }, { slug: targetId }] },
        select: {
          id: true,
          slug: true,
          ownerUserId: true,
          visibility: true,
          status: true
        }
      });
      if (!circle) throw new NotFoundException('Destination introuvable.');
      if (circle.ownerUserId === ownerId) return normalizeTargetId(circle.slug);
      if (circle.visibility === 'PUBLIC' && circle.status === 'ACTIVE') {
        return normalizeTargetId(circle.slug);
      }
      const member = await this.prisma.profileCircleMember.findFirst({
        where: { circleId: circle.id, userId: ownerId, status: 'ACTIVE' },
        select: { id: true }
      });
      if (!member) throw new ForbiddenException('Destination non partageable.');
      return normalizeTargetId(circle.slug);
    }

    // Re-check creator access whenever a short link is resolved. Viewers are
    // independently authorized by the link-targets API after opening it.
    if (kind === 'sticker-pack') {
      if (stickerCatalog().some(pack => pack.key === targetId)) return targetId;
      throw new ForbiddenException('Destination non partageable.');
    }

    if (kind === 'sticker') {
      const parts = targetId.split('__');
      if (parts.length === 2 && findSticker(parts[0], parts[1])) return targetId;
      throw new NotFoundException('Destination introuvable.');
    }

    if (kind === 'post') {
      const post = await this.prisma.post.findUnique({ where: { id: targetId }, select: { id: true } });
      if (post) return post.id;
      throw new NotFoundException('Destination introuvable.');
    }

    if (kind === 'comment') {
      const comment = await this.prisma.postComment.findUnique({ where: { id: targetId }, select: { id: true } });
      if (comment) return comment.id;
      throw new NotFoundException('Destination introuvable.');
    }

    // Public short-link resolution exposes a destination ID before the viewer logs in.
    // Keep PRIVATE message/conversation/media links on the authenticated direct-link
    // resolver until short links can bind resolution to viewer authorization.
    if (kind === 'message' || kind === 'conversation' || kind === 'group' || kind === 'media') {
      throw new ForbiddenException('Les liens courts privés exigent une vérification du destinataire.');
    }

    if (kind === 'channel') {
      const channel = await this.prisma.channel.findUnique({
        where: {id:targetId},select:{id:true,visibility:true}
      });
      if (!channel || channel.visibility !== 'PUBLIC') {
        throw new ForbiddenException('Destination non partageable publiquement.');
      }
      return channel.id;
    }

    if (kind === 'channel-post') {
      const post = await this.prisma.channelPost.findUnique({
        where: {id:targetId},select:{id:true,channel:{select:{visibility:true}}}
      });
      if (!post || post.channel.visibility !== 'PUBLIC') {
        throw new ForbiddenException('Destination non partageable publiquement.');
      }
      return post.id;
    }

    if (kind === 'gift') {
      // Anonymous short-link resolution exposes the target ID. Individual gift
      // receipts must remain authenticated-only, including existing short codes.
      throw new ForbiddenException('Les cadeaux exigent une vérification du destinataire.');
    }

    throw new ForbiddenException('Ce type de destination n’est pas encore partageable.');
  }

  private serialize(link: {
    id: string;
    code: string;
    targetKind: string;
    targetId: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
  }): OwnerShortLink {
    const kind = assertShortLinkKind(link.targetKind);
    const destination = buildShortLinkDestination(kind, link.targetId);
    return {
      id: link.id,
      code: link.code,
      shortPath: `/s/${link.code}`,
      kind,
      targetId: link.targetId,
      ...destination,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      revokedAt: link.revokedAt?.toISOString() ?? null
    };
  }

  private unavailable() {
    return new NotFoundException('Lien indisponible.');
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  policy() {
    return shortLinkPolicy();
  }
}
