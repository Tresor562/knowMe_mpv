import { BadRequestException, ConflictException } from '@nestjs/common';
import { AvatarDnaService } from './avatar-dna.service';
import {
  AVATAR_DNA_DEFAULT_KEYS,
  AVATAR_DNA_SCHEMA_VERSION,
  AvatarDNA
} from './avatar-dna.domain';
import { AVATAR_DEFAULT_MORPHOLOGY, AVATAR_DEFAULT_PERSONALITY } from './avatar-universe.domain';

describe('AvatarDnaService', () => {
  const userId = 'user-avatar-1';

  const dna = (revision = 1): AvatarDNA => ({
    schemaVersion: AVATAR_DNA_SCHEMA_VERSION,
    revision,
    morphology: { ...AVATAR_DEFAULT_MORPHOLOGY },
    personality: { ...AVATAR_DEFAULT_PERSONALITY },
    renderTier: 'REALTIME_3D_BALANCED',
    ...AVATAR_DNA_DEFAULT_KEYS
  });

  function makePrisma(profile: any = dna()) {
    const tx = {
      avatarIdentityProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        create: jest.fn(async ({ data }) => data),
        update: jest.fn(async ({ data }) => ({ ...profile, ...data }))
      }
    };
    const prisma = {
      avatarIdentityProfile: tx.avatarIdentityProfile,
      $transaction: jest.fn(async (callback: any) => callback(tx))
    };
    return { prisma: prisma as any, tx };
  }

  it('rejects stale revisions before writing', async () => {
    const { prisma, tx } = makePrisma(dna(4));
    const service = new AvatarDnaService(prisma);

    await expect(service.update(userId, {
      ...dna(3),
      expectedRevision: 3
    })).rejects.toBeInstanceOf(ConflictException);

    expect(tx.avatarIdentityProfile.update).not.toHaveBeenCalled();
  });

  it('increments the authoritative revision exactly once', async () => {
    const { prisma, tx } = makePrisma(dna(7));
    const service = new AvatarDnaService(prisma);

    const result = await service.update(userId, {
      ...dna(7),
      expectedRevision: 7
    });

    expect(tx.avatarIdentityProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId },
      data: expect.objectContaining({ revision: 8 })
    }));
    expect(result.revision).toBe(8);
  });

  it('rejects a forged morphology control instead of persisting it', async () => {
    const { prisma, tx } = makePrisma(dna());
    const service = new AvatarDnaService(prisma);
    const hostile = dna() as any;
    hostile.morphology = {
      ...hostile.morphology,
      unlockPremiumMesh: 100
    };

    await expect(service.update(userId, {
      ...hostile,
      expectedRevision: 1
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.avatarIdentityProfile.update).not.toHaveBeenCalled();
  });

  it('rejects non-safe expected revisions before opening a transaction', async () => {
    const { prisma } = makePrisma(dna());
    const service = new AvatarDnaService(prisma);

    await expect(service.update(userId, {
      ...dna(),
      expectedRevision: Number.MAX_SAFE_INTEGER + 1
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow a client to skip the initial revision when no profile exists', async () => {
    const { prisma, tx } = makePrisma(null);
    const service = new AvatarDnaService(prisma);

    await expect(service.update(userId, {
      ...dna(2),
      expectedRevision: 2
    })).rejects.toBeInstanceOf(ConflictException);

    expect(tx.avatarIdentityProfile.create).not.toHaveBeenCalled();
  });
});
