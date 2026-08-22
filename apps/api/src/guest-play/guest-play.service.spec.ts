import { UnauthorizedException } from '@nestjs/common';
import { GuestAgeGateState, GuestIdentityStatus } from '@prisma/client';
import {
  extractGuestBearerToken,
  extractGuestToken,
  GUEST_SESSION_TTL_MS,
  GuestPlayService
} from './guest-play.service';

function guest(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'guest_1',
    publicAlias: 'Player One',
    tokenHash: 'hashed',
    locale: 'fr-BJ',
    consentVersion: '2026-08-22',
    ageGateState: GuestAgeGateState.ADULT,
    status: GuestIdentityStatus.ACTIVE,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + GUEST_SESSION_TTL_MS),
    revokedAt: null,
    convertedUserId: null,
    convertedAt: null,
    ...overrides
  };
}

describe('GuestPlayService', () => {
  it('accepts only the bounded KnowMe guest token shapes', () => {
    const token = `kg_${'A'.repeat(43)}`;
    expect(extractGuestBearerToken(`Bearer ${token}`)).toBe(token);
    expect(extractGuestBearerToken(`bearer ${token}`)).toBeNull();
    expect(extractGuestBearerToken(`Bearer ${'A'.repeat(43)}`)).toBeNull();
    expect(extractGuestBearerToken('Bearer kg_short')).toBeNull();
    expect(extractGuestBearerToken()).toBeNull();
    expect(extractGuestToken(token)).toBe(token);
    expect(extractGuestToken(` ${token} `)).toBe(token);
    expect(extractGuestToken('kg_short')).toBeNull();
    expect(extractGuestToken()).toBeNull();
  });

  it('returns the raw token only once while persisting only its hash', async () => {
    let persisted: Record<string, unknown> | undefined;
    const stored = guest();
    const prisma = {
      guestIdentity: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          persisted = data;
          return { ...stored, ...data };
        })
      }
    } as any;
    const service = new GuestPlayService(prisma);

    const result = await service.createSession({
      publicAlias: '  Player One  ',
      locale: 'fr-BJ',
      consentVersion: '2026-08-22',
      ageGateState: 'ADULT'
    });

    expect(result.token).toMatch(/^kg_[A-Za-z0-9_-]{43}$/);
    expect(persisted?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted?.tokenHash).not.toBe(result.token);
    expect(persisted?.publicAlias).toBe('Player One');
    expect(result.guest).not.toHaveProperty('tokenHash');
    expect(result.guest).not.toHaveProperty('email');
    expect(result.guest).not.toHaveProperty('contacts');

    const expiresAt = new Date(result.guest.expiresAt).getTime();
    const createdAt = new Date(result.guest.createdAt).getTime();
    expect(expiresAt - createdAt).toBeGreaterThan(GUEST_SESSION_TTL_MS - 5_000);
    expect(expiresAt - createdAt).toBeLessThanOrEqual(GUEST_SESSION_TTL_MS + 5_000);
  });

  it('rejects expired, revoked and converted guest identities with the same generic error', async () => {
    for (const invalid of [
      guest({ expiresAt: new Date(Date.now() - 1) }),
      guest({ status: GuestIdentityStatus.REVOKED }),
      guest({ convertedUserId: 'user_1' })
    ]) {
      const prisma = {
        guestIdentity: {
          findUnique: jest.fn(async () => invalid),
          update: jest.fn()
        }
      } as any;
      const service = new GuestPlayService(prisma);
      const token = `kg_${'B'.repeat(43)}`;
      await expect(service.sessionFromAuthorization(`Bearer ${token}`)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.guestIdentity.update).not.toHaveBeenCalled();
    }
  });

  it('touches a valid guest without exposing credential material', async () => {
    const stored = guest();
    const prisma = {
      guestIdentity: {
        findUnique: jest.fn(async () => stored),
        update: jest.fn(async ({ data }: { data: { lastSeenAt: Date } }) => ({ ...stored, ...data }))
      }
    } as any;
    const service = new GuestPlayService(prisma);
    const token = `kg_${'C'.repeat(43)}`;

    const result = await service.sessionFromAuthorization(`Bearer ${token}`);

    expect(result.id).toBe(stored.id);
    expect(result).not.toHaveProperty('tokenHash');
    expect(prisma.guestIdentity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: stored.id }
    }));
  });

  it('revokes the server-side guest credential and never returns it', async () => {
    const stored = guest();
    const prisma = {
      guestIdentity: {
        findUnique: jest.fn(async () => stored),
        update: jest.fn(async () => stored)
      }
    } as any;
    const service = new GuestPlayService(prisma);
    const token = `kg_${'D'.repeat(43)}`;

    await expect(service.revokeFromAuthorization(`Bearer ${token}`)).resolves.toEqual({ revoked: true });
    expect(prisma.guestIdentity.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: GuestIdentityStatus.REVOKED })
    }));
  });

  it('converts a guest exactly once to the authenticated account without inventing transferable data', async () => {
    const tx = {
      user: { findUnique: jest.fn(async () => ({ id: 'user_1' })) },
      guestIdentity: { updateMany: jest.fn(async () => ({ count: 1 })) }
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx))
    } as any;
    const service = new GuestPlayService(prisma);
    const token = `kg_${'E'.repeat(43)}`;

    await expect(service.convertToUser(token, 'user_1')).resolves.toEqual({
      converted: true,
      transferred: { gameplayData: false, scores: 0, achievements: 0, preferences: 0 }
    });
    expect(tx.guestIdentity.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: GuestIdentityStatus.ACTIVE,
        convertedUserId: null,
        expiresAt: { gt: expect.any(Date) }
      }),
      data: expect.objectContaining({
        status: GuestIdentityStatus.CONVERTED,
        convertedUserId: 'user_1',
        convertedAt: expect.any(Date)
      })
    }));
  });

  it('fails closed when conversion cannot atomically claim exactly one active guest', async () => {
    const tx = {
      user: { findUnique: jest.fn(async () => ({ id: 'user_1' })) },
      guestIdentity: { updateMany: jest.fn(async () => ({ count: 0 })) }
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx))
    } as any;
    const service = new GuestPlayService(prisma);
    const token = `kg_${'F'.repeat(43)}`;

    await expect(service.convertToUser(token, 'user_1')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
