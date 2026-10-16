import { Prisma } from '@prisma/client';
import { QuestsService } from './quests.service';

describe('QuestsService', () => {
  const service = new QuestsService({} as never);

  it('normalizes every contribution to its UTC quest day', () => {
    expect(service.questDay(new Date('2026-08-02T23:59:59.000Z'))).toEqual(
      new Date('2026-08-02T00:00:00.000Z')
    );
    expect(service.questDay(new Date('2026-08-03T00:00:01.000Z'))).toEqual(
      new Date('2026-08-03T00:00:00.000Z')
    );
  });

  it('does not mutate the supplied timestamp', () => {
    const input = new Date('2026-08-02T18:30:00.000Z');
    const before = input.toISOString();

    service.questDay(input);

    expect(input.toISOString()).toBe(before);
  });
  it('recovers from several concurrent PostgreSQL serialization conflicts', async () => {
    const row = {
      id: 'progress-1',
      userId: 'player-1',
      questKey: 'daily_challenge_explorer',
      questDate: new Date('2026-10-16T00:00:00.000Z'),
      target: 1,
      progress: 1,
      status: 'COMPLETED',
      completedAt: new Date('2026-10-16T10:00:00.000Z'),
      createdAt: new Date('2026-10-16T10:00:00.000Z'),
      updatedAt: new Date('2026-10-16T10:00:00.000Z')
    };
    let calls = 0;
    const transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      calls += 1;
      if (calls < 6) {
        throw new Prisma.PrismaClientKnownRequestError('serialization failure', {
          code: 'P2034', clientVersion: '6.12.0'
        });
      }
      return callback({
        dailyQuestContribution: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'contribution' })
        },
        dailyQuestProgress: {
          upsert: jest.fn().mockResolvedValue({ ...row, status: 'OPEN', progress: 0 }),
          update: jest.fn().mockResolvedValue(row)
        }
      });
    });
    const service = new QuestsService({
      dailyQuestContribution: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: transaction
    } as never);
    const completion = await service.processChallengeCompletion({
      participantId: 'participant-1',
      userId: 'player-1',
      creatorId: 'creator-1',
      challengeId: 'challenge-1',
      questionCount: 3,
      completedAt: row.completedAt!
    });
    expect(transaction).toHaveBeenCalledTimes(6);
    expect(completion.reasonCode).toBe('QUEST_COMPLETED');
    expect(completion.completedNow).toBe(true);
  });

});
