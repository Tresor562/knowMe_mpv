import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GrantEntitlementDto,
  RevokeEntitlementDto
} from './dto/entitlement.dto';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const now = new Date();
    const grants = await this.prisma.entitlementGrant.findMany({
      where: this.activeWhere(userId, now),
      select: {
        id: true,
        key: true,
        source: true,
        startsAt: true,
        expiresAt: true
      },
      orderBy: [{ key: 'asc' }, { expiresAt: 'desc' }]
    });

    const unique = new Map<string, (typeof grants)[number]>();
    for (const grant of grants) {
      if (!unique.has(grant.key)) unique.set(grant.key, grant);
    }

    return {
      accountId: userId,
      serverTime: now,
      entitlements: [...unique.values()]
    };
  }

  async hasAll(userId: string, keys: string[]) {
    const normalized = [...new Set(keys.map((key) => this.normalizeKey(key)))];
    if (!normalized.length) return true;

    const now = new Date();
    const grants = await this.prisma.entitlementGrant.findMany({
      where: {
        ...this.activeWhere(userId, now),
        key: { in: normalized }
      },
      select: { key: true }
    });

    const active = new Set(grants.map((grant) => grant.key));
    return normalized.every((key) => active.has(key));
  }

  async listAdmin(userId?: string) {
    return this.prisma.entitlementGrant.findMany({
      where: userId ? { userId } : undefined,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async grant(actorId: string, dto: GrantEntitlementDto) {
    const key = this.normalizeKey(dto.key);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException(
        'La date d’expiration doit être postérieure au début du droit.'
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

    const duplicate = await this.prisma.entitlementGrant.findFirst({
      where: {
        userId: dto.userId,
        key,
        source: dto.source,
        externalReference: dto.externalReference?.trim() || null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    if (duplicate) {
      throw new ConflictException('Un droit actif identique existe déjà.');
    }

    const grant = await this.prisma.entitlementGrant.create({
      data: {
        userId: dto.userId,
        key,
        source: dto.source,
        externalReference: dto.externalReference?.trim() || null,
        startsAt,
        expiresAt,
        reason: dto.reason?.trim() || null,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined
      }
    });

    await this.audit(actorId, 'ENTITLEMENT_GRANT', grant.id, {
      accountId: dto.userId,
      key,
      source: dto.source,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
      externalReference: grant.externalReference
    });

    return grant;
  }

  async revoke(
    actorId: string,
    grantId: string,
    dto: RevokeEntitlementDto
  ) {
    const grant = await this.prisma.entitlementGrant.findUnique({
      where: { id: grantId }
    });
    if (!grant) throw new NotFoundException('Droit introuvable.');

    if (grant.revokedAt) return grant;

    const revoked = await this.prisma.entitlementGrant.update({
      where: { id: grantId },
      data: {
        revokedAt: new Date(),
        revokedById: actorId,
        reason: dto.reason?.trim() || grant.reason
      }
    });

    await this.audit(actorId, 'ENTITLEMENT_REVOKE', grant.id, {
      accountId: grant.userId,
      key: grant.key,
      source: grant.source,
      reason: dto.reason?.trim() || null
    });

    return revoked;
  }

  private activeWhere(userId: string, now: Date) {
    return {
      userId,
      startsAt: { lte: now },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    } satisfies Prisma.EntitlementGrantWhereInput;
  }

  private normalizeKey(key: string) {
    return key.trim().toLowerCase();
  }

  private audit(
    actorId: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonObject
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'EntitlementGrant',
        entityId,
        metadata
      }
    });
  }
}
