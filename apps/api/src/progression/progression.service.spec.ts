import { ProgressionService } from './progression.service';

describe('ProgressionService', () => {
  const now = new Date('2026-08-02T09:00:00.000Z');

  function createService(options?: {
    existingEntry?: Record<string, unknown> | null;
    totalXp?: number;
  }) {
    const totalXp = options?.totalXp ?? 0;
    const existingEntry = options?.existingEntry ?? null;
    const transactionClient = {
      xpLedgerEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({
          id: 'xp-entry-1',
          ...data,
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          metadata: data.metadata ?? null,
          createdAt: now
        })),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: totalXp } })
      },
      userProgression: {
        upsert: jest.fn(async ({ create, update }) => ({
          ...(totalXp === 0 ? create : update),
          userId: 'player-1',
          totalXp,
          level: Math.floor(Math.sqrt(totalXp / 100)) + 1,
          createdAt: now,
          updatedAt: now
        }))
      }
    };
    const prisma = {
      xpLedgerEntry: {
        findUnique: jest.fn().mockResolvedValue(existingEntry),
        findMany: jest.fn().mockResolvedValue([])
      },
      userProgression: {
        upsert: jest.fn()
      },
      $transaction: jest.fn(async (callback) => callback(transactionClient))
    };
    return {
      service: new ProgressionService(prisma as never),
      prisma,
      transactionClient
    };
  }

  it('calculates deterministic quadratic level thresholds', () => {
    const { service } = createService();

    expect(service.describeProgress(0)).toEqual(
      expect.objectContaining({ level: 1, nextLevelXp: 100, xpToNextLevel: 100 })
    );
    expect(service.describeProgress(99).level).toBe(1);
    expect(service.describeProgress(100)).toEqual(
      expect.objectContaining({
        level: 2,
        currentLevelStartXp: 100,
        nextLevelXp: 400,
        xpIntoLevel: 0
      })
    );
    expect(service.describeProgress(400).level).toBe(3);
    expect(service.describeProgress(-50).totalXp).toBe(0);
  });

  it('awards challenge XP once and reports a level up', async () => {
    const { service, transactionClient } = createService({ totalXp: 100 });

    const result = await service.processChallengeCompletion({
      participantId: 'participant-2',
      userId: 'player-1',
      creatorId: 'creator-1',
      challengeId: 'challenge-2',
      questionCount: 3,
      completedAt: now
    });

    expect(result).toEqual(
      expect.objectContaining({
        awarded: true,
        replayed: false,
        amount: 50,
        levelUp: true,
        profile: expect.objectContaining({ totalXp: 100, level: 2 })
      })
    );
    expect(transactionClient.xpLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'xp:challenge-completion:participant-2',
          amount: 50,
          source: 'CHALLENGE_COMPLETION'
        })
      })
    );
  });

  it('never awards XP for a self challenge', async () => {
    const { service, transactionClient } = createService({ totalXp: 0 });

    const result = await service.processChallengeCompletion({
      participantId: 'creator-participation',
      userId: 'creator-1',
      creatorId: 'creator-1',
      challengeId: 'challenge-self',
      questionCount: 3,
      completedAt: now
    });

    expect(result).toEqual(
      expect.objectContaining({
        awarded: false,
        reasonCode: 'SELF_CHALLENGE',
        amount: 0
      })
    );
    expect(transactionClient.xpLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('replays an existing immutable ledger entry', async () => {
    const entry = {
      id: 'xp-existing',
      userId: 'player-1',
      amount: 50,
      source: 'CHALLENGE_COMPLETION',
      reason: 'Première complétion éligible d’un défi KnowMe.',
      idempotencyKey: 'xp:challenge-completion:participant-existing',
      referenceType: 'CHALLENGE_PARTICIPANT',
      referenceId: 'participant-existing',
      metadata: null,
      createdAt: now
    };
    const { service, transactionClient } = createService({
      existingEntry: entry,
      totalXp: 50
    });

    const result = await service.processChallengeCompletion({
      participantId: 'participant-existing',
      userId: 'player-1',
      creatorId: 'creator-1',
      challengeId: 'challenge-existing',
      questionCount: 3,
      completedAt: now
    });

    expect(result).toEqual(
      expect.objectContaining({ awarded: true, replayed: true, amount: 50 })
    );
    expect(transactionClient.xpLedgerEntry.create).not.toHaveBeenCalled();
  });
});
