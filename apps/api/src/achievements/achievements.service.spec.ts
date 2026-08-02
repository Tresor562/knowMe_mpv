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
});
