import { ForbiddenException } from '@nestjs/common';
import { ChallengeResultsService } from './challenge-results.service';

describe('ChallengeResultsService', () => {
  const now = new Date('2026-08-02T08:00:00.000Z');

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      challengeResultSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({
          id: 'result-1',
          ...data,
          createdAt: now,
          updatedAt: now
        })),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      challengeReferenceSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest.fn()
      },
      challenge: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      },
      challengeQuestion: {
        findMany: jest.fn().mockResolvedValue([])
      },
      challengeParticipant: {
        findUnique: jest.fn()
      },
      $transaction: jest.fn(async (operations) => Promise.all(operations)),
      ...overrides
    };
    const audit = { record: jest.fn() };
    return {
      service: new ChallengeResultsService(prisma as never, audit as never),
      prisma,
      audit
    };
  }

  it('normalizes case, Unicode and spaces before scoring', async () => {
    const referenceAnswers = [
      {
        questionId: 'q1',
        position: 0,
        prompt: 'Ville ?',
        answer: 'Cotonou',
        normalizedHash:
          'e91cfd3fd7f49c5211bddc83298401a66245d55d47475995d214d86f1f6fd959'
      },
      {
        questionId: 'q2',
        position: 1,
        prompt: 'Couleur ?',
        answer: 'Bleu',
        normalizedHash:
          '50ab0299c6f88a48cb8e5a3f9122f7cc8ce015641a4f18cdeece9a75361a6ff1'
      },
      {
        questionId: 'q3',
        position: 2,
        prompt: 'Plat ?',
        answer: 'Pizza',
        normalizedHash:
          '9ed1515819dec61fd361d5fdabb57f41ecce1a5fe1fe263b98c0d6943b9b232e'
      }
    ];
    const { service, prisma } = createService();
    prisma.challengeReferenceSnapshot.findUnique.mockResolvedValue({
      id: 'reference-1',
      challengeId: 'challenge-1',
      challengeVersion: 1,
      createdById: 'creator-1',
      answers: referenceAnswers,
      createdAt: now
    });

    const response = await service.recordCompletion({
      participantId: 'participant-1',
      userId: 'player-1',
      creatorId: 'creator-1',
      challengeId: 'challenge-1',
      challengeVersion: 1,
      questions: [
        { id: 'q1', position: 0, prompt: 'Ville ?' },
        { id: 'q2', position: 1, prompt: 'Couleur ?' },
        { id: 'q3', position: 2, prompt: 'Plat ?' }
      ],
      answers: [
        { questionId: 'q1', value: '  COTONOU  ' },
        { questionId: 'q2', value: 'bleu' },
        { questionId: 'q3', value: 'Riz' }
      ],
      completedAt: now
    });

    expect(response.result).toEqual(
      expect.objectContaining({
        status: 'SCORED',
        score: 67,
        correctCount: 2,
        questionCount: 3
      })
    );
    expect(response.result?.feedback?.map((item) => item.correct)).toEqual([
      true,
      true,
      false
    ]);
    expect(prisma.challengeResultSnapshot.create).toHaveBeenCalledTimes(1);
  });

  it('replays the first immutable result instead of creating another one', async () => {
    const existing = {
      id: 'result-existing',
      challengeId: 'challenge-1',
      participantId: 'participant-1',
      userId: 'player-1',
      challengeVersion: 1,
      status: 'SCORED',
      score: 100,
      correctCount: 1,
      questionCount: 1,
      answers: [],
      feedback: [],
      completedAt: now,
      scoredAt: now,
      createdAt: now,
      updatedAt: now
    };
    const { service, prisma } = createService();
    prisma.challengeResultSnapshot.findUnique.mockResolvedValue(existing);

    const response = await service.recordCompletion({
      participantId: 'participant-1',
      userId: 'player-1',
      creatorId: 'creator-1',
      challengeId: 'challenge-1',
      challengeVersion: 1,
      questions: [{ id: 'q1', position: 0, prompt: 'Question ?' }],
      answers: [{ questionId: 'q1', value: 'Nouvelle valeur' }],
      completedAt: now
    });

    expect(response.result?.id).toBe('result-existing');
    expect(prisma.challengeResultSnapshot.create).not.toHaveBeenCalled();
  });

  it('refuses reference locking by a non-creator', async () => {
    const { service, prisma } = createService();
    prisma.challenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      creatorId: 'creator-1'
    });

    await expect(
      service.setReference('intruder-1', 'challenge-1', 1, [
        { questionId: 'q1', value: 'Réponse' }
      ])
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
