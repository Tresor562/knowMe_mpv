import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GuestAgeGateState, GuestIdentityStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestSessionDto } from './guest-play.dto';

export const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const GUEST_TOKEN_PREFIX = 'kg_';

function hashGuestToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function extractGuestBearerToken(authorization?: string) {
  if (!authorization) return null;
  const match = /^Bearer (kg_[A-Za-z0-9_-]{43})$/.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function extractGuestToken(token?: string) {
  if (!token) return null;
  const normalized = token.trim();
  return /^kg_[A-Za-z0-9_-]{43}$/.test(normalized) ? normalized : null;
}

@Injectable()
export class GuestPlayService {
  constructor(private readonly prisma: PrismaService) {}

  policy() {
    return {
      ttlSeconds: GUEST_SESSION_TTL_MS / 1000,
      storesRealIdentity: false,
      storesContacts: false,
      requiresAccount: false,
      supportsGameplay: false,
      conversionEnabled: true,
      conversionTransfersGameplayData: false
    } as const;
  }

  async createSession(dto: CreateGuestSessionDto) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GUEST_SESSION_TTL_MS);
    const token = `${GUEST_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const tokenHash = hashGuestToken(token);

    const guest = await this.prisma.guestIdentity.create({
      data: {
        publicAlias: dto.publicAlias?.trim() || null,
        tokenHash,
        locale: dto.locale,
        consentVersion: dto.consentVersion,
        ageGateState: dto.ageGateState as GuestAgeGateState,
        expiresAt
      }
    });

    return {
      token,
      guest: this.publicProjection(guest)
    };
  }

  async sessionFromAuthorization(authorization?: string) {
    const token = extractGuestBearerToken(authorization);
    if (!token) throw this.invalidGuestSession();

    const guest = await this.activeGuest(token);
    const now = new Date();

    const touched = await this.prisma.guestIdentity.update({
      where: { id: guest.id },
      data: { lastSeenAt: now }
    });

    return this.publicProjection(touched);
  }

  async revokeFromAuthorization(authorization?: string) {
    const token = extractGuestBearerToken(authorization);
    if (!token) throw this.invalidGuestSession();

    const guest = await this.activeGuest(token);
    const now = new Date();
    await this.prisma.guestIdentity.update({
      where: { id: guest.id },
      data: {
        status: GuestIdentityStatus.REVOKED,
        revokedAt: now,
        lastSeenAt: now
      }
    });

    return { revoked: true } as const;
  }

  async convertToUser(rawGuestToken: string | undefined, userId: string) {
    const token = extractGuestToken(rawGuestToken);
    if (!token) throw this.invalidGuestSession();

    const now = new Date();
    const tokenHash = hashGuestToken(token);

    const converted = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!user) return false;

      const updated = await tx.guestIdentity.updateMany({
        where: {
          tokenHash,
          status: GuestIdentityStatus.ACTIVE,
          convertedUserId: null,
          expiresAt: { gt: now }
        },
        data: {
          status: GuestIdentityStatus.CONVERTED,
          convertedUserId: userId,
          convertedAt: now,
          lastSeenAt: now
        }
      });

      return updated.count === 1;
    });

    if (!converted) throw this.invalidGuestSession();

    return {
      converted: true,
      transferred: {
        gameplayData: false,
        scores: 0,
        achievements: 0,
        preferences: 0
      }
    } as const;
  }

  private async activeGuest(token: string) {
    const guest = await this.prisma.guestIdentity.findUnique({
      where: { tokenHash: hashGuestToken(token) }
    });
    const now = Date.now();

    if (
      !guest ||
      guest.status !== GuestIdentityStatus.ACTIVE ||
      guest.expiresAt.getTime() <= now ||
      guest.convertedUserId
    ) {
      throw this.invalidGuestSession();
    }

    return guest;
  }

  private publicProjection(guest: {
    id: string;
    publicAlias: string | null;
    locale: string;
    consentVersion: string;
    ageGateState: GuestAgeGateState;
    status: GuestIdentityStatus;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
  }) {
    return {
      id: guest.id,
      publicAlias: guest.publicAlias,
      locale: guest.locale,
      consentVersion: guest.consentVersion,
      ageGateState: guest.ageGateState,
      status: guest.status,
      createdAt: guest.createdAt.toISOString(),
      lastSeenAt: guest.lastSeenAt.toISOString(),
      expiresAt: guest.expiresAt.toISOString()
    };
  }

  private invalidGuestSession() {
    return new UnauthorizedException('Guest session is invalid or expired');
  }
}
