import { BadRequestException } from '@nestjs/common';
import { AchievementsService } from './achievements.service';

describe('AchievementsService', () => {
  const completedAt = new Date('2026-08-02T09:00:00.000Z');
  const emptySummary = {
    selectedTitle: null,
    badges: [],
    titles: [],
    history: [],
    rules: {
      serverAuthoritative: true,
      paidMeritAllowed: false,
      verificationSeparation: true,
      staffSeparation: true,
      premiumSeparation: true
    }
  };

  it('never grants merit for a self challenge', async () => {
    const service = new AchievementsService({} as never);
    jest.spyOn(service, 'summary').mockResolvedValue(emptySummary);

    const result = await service.processChallengeCompletion(
      {
        participantId: 'self-participant',
        userId: 'creator-1',
        creatorId: 'creator-1',
        challengeId: 'challenge-1',
        questionCount: 3,
        completedAt
      },
      2
    );

    expect(result).toEqual(
      expect.objectContaining({
        reasonCode: 'SELF_CHALLENGE',
        grantedNow: [],
        replayed: []
      })
    );
  });

  it('never grants merit for a challenge with fewer than three questions', async () => {
    const service = new AchievementsService({} as never);
    jest.spyOn(service, 'summary').mockResolvedValue(emptySummary);

    const result = await service.processChallengeCompletion(
      {
        participantId: 'short-participant',
        userId: 'player-1',
        creatorId: 'creator-1',
        challengeId: 'challenge-short',
        questionCount: 2,
        completedAt
      },
      2
    );

    expect(result).toEqual(
      expect.objectContaining({
        reasonCode: 'MIN_QUESTIONS',
        grantedNow: [],
        replayed: []
      })
    );
  });

  it('rejects a title that is not an active grant of the account', async () => {
    const service = new AchievementsService({
      achievementGrant: { findFirst: jest.fn().mockResolvedValue(null) }
    } as never);

    await expect(service.selectTitle('player-1', 'foreign-title')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
  it('initializes the static catalog only once for simultaneous and later requests', async () => {
    const upsert = jest.fn().mockImplementation(async ({ create }: { create: { key: string; version: number } }) =>
      ({ id: create.key, key: create.key, version: create.version })
    );
    const prisma = { achievementDefinition: { upsert } };
    const service = new AchievementsService(prisma as never);
    const method = (service as unknown as { ensureCatalog: () => Promise<unknown[]> })
      .ensureCatalog.bind(service);

    const [first, second] = await Promise.all([method(), method()]);
    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    await method();
    expect(upsert).toHaveBeenCalledTimes(4);
  });

  it('retries catalogue initialization when an earlier database attempt fails', async () => {
    const upsert = jest.fn()
      .mockRejectedValueOnce(new Error('database offline'))
      .mockImplementation(async ({ create }: { create: { key: string; version: number } }) =>
        ({ id: create.key, key: create.key, version: create.version })
      );
    const service = new AchievementsService({
      achievementDefinition: { upsert }
    } as never);
    const method = (service as unknown as { ensureCatalog: () => Promise<unknown[]> })
      .ensureCatalog.bind(service);

    await expect(method()).rejects.toThrow('database offline');
    await expect(method()).resolves.toHaveLength(4);
    expect(upsert).toHaveBeenCalledTimes(8);
  });

});
