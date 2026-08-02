import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative XP progression (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.xpLedgerEntry.deleteMany();
    await prisma.userProgression.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@progression.knowme.test`,
        username: `xp_${label}`,
        displayName: `XP ${label}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  function authorization(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createChallenge(
    token: string,
    label: string,
    questionCount = 3
  ) {
    return request(app.getHttpServer())
      .post('/challenges')
      .set(authorization(token))
      .send({
        title: `Défi XP ${label}`,
        description: 'Validation du registre XP autoritaire.',
        questions: Array.from(
          { length: questionCount },
          (_, index) => `Question ${index + 1} du défi ${label} ?`
        )
      })
      .expect(201);
  }

  async function join(token: string, challengeId: string) {
    return request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(authorization(token))
      .expect(201);
  }

  function answerRequest(
    token: string,
    challenge: { id: string; questions: Array<{ id: string }> },
    suffix: string
  ) {
    return request(app.getHttpServer())
      .post(`/challenges/${challenge.id}/answers`)
      .set(authorization(token))
      .send({
        answers: challenge.questions.map((question, index) => ({
          questionId: question.id,
          value: `Réponse ${suffix} ${index + 1}`
        }))
      });
  }

  it('keeps XP immutable, idempotent and server-authoritative', async () => {
    const creator = await register('creator');
    const player = await register('player');
    const creatorToken = creator.body.accessToken as string;
    const playerToken = player.body.accessToken as string;
    const creatorId = creator.body.user.id as string;
    const playerId = player.body.user.id as string;

    const first = await createChallenge(creatorToken, 'first');

    const selfCompletion = await answerRequest(
      creatorToken,
      first.body,
      'créateur'
    ).expect(201);
    expect(selfCompletion.body.progression).toEqual(
      expect.objectContaining({
        awarded: false,
        amount: 0,
        reasonCode: 'SELF_CHALLENGE'
      })
    );
    expect(await prisma.xpLedgerEntry.count({ where: { userId: creatorId } })).toBe(0);

    await join(playerToken, first.body.id);
    const firstCompletion = await answerRequest(
      playerToken,
      first.body,
      'première'
    ).expect(201);
    expect(firstCompletion.body.progression).toEqual(
      expect.objectContaining({
        awarded: true,
        replayed: false,
        amount: 50,
        levelUp: false,
        profile: expect.objectContaining({ totalXp: 50, level: 1 })
      })
    );

    const firstReplay = await answerRequest(
      playerToken,
      first.body,
      'réécriture refusée'
    ).expect(201);
    expect(firstReplay.body.progression).toEqual(
      expect.objectContaining({
        awarded: true,
        replayed: true,
        amount: 50,
        levelUp: false,
        profile: expect.objectContaining({ totalXp: 50, level: 1 })
      })
    );
    expect(await prisma.xpLedgerEntry.count({ where: { userId: playerId } })).toBe(1);

    const second = await createChallenge(creatorToken, 'second');
    await join(playerToken, second.body.id);
    const secondCompletion = await answerRequest(
      playerToken,
      second.body,
      'seconde'
    ).expect(201);
    expect(secondCompletion.body.progression).toEqual(
      expect.objectContaining({
        awarded: true,
        amount: 50,
        levelUp: true,
        profile: expect.objectContaining({ totalXp: 100, level: 2 })
      })
    );

    const concurrent = await createChallenge(creatorToken, 'concurrent');
    await join(playerToken, concurrent.body.id);
    const concurrentResponses = await Promise.all([
      answerRequest(playerToken, concurrent.body, 'concurrent A'),
      answerRequest(playerToken, concurrent.body, 'concurrent B')
    ]);
    expect(concurrentResponses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      concurrentResponses.every(
        (response) =>
          response.body.progression.awarded === true &&
          response.body.progression.amount === 50
      )
    ).toBe(true);

    const concurrentParticipant = await prisma.challengeParticipant.findUnique({
      where: {
        challengeId_userId: {
          challengeId: concurrent.body.id,
          userId: playerId
        }
      }
    });
    expect(concurrentParticipant).not.toBeNull();
    const concurrentEntries = await prisma.xpLedgerEntry.findMany({
      where: {
        idempotencyKey: `xp:challenge-completion:${concurrentParticipant!.id}`
      }
    });
    expect(concurrentEntries).toHaveLength(1);
    expect(concurrentEntries[0]).toEqual(
      expect.objectContaining({
        userId: playerId,
        amount: 50,
        source: 'CHALLENGE_COMPLETION',
        referenceId: concurrentParticipant!.id
      })
    );

    const short = await createChallenge(creatorToken, 'short', 2);
    await join(playerToken, short.body.id);
    const shortCompletion = await answerRequest(
      playerToken,
      short.body,
      'courte'
    ).expect(201);
    expect(shortCompletion.body.progression).toEqual(
      expect.objectContaining({
        awarded: false,
        amount: 0,
        reasonCode: 'MIN_QUESTIONS',
        profile: expect.objectContaining({ totalXp: 150, level: 2 })
      })
    );

    const summary = await request(app.getHttpServer())
      .get('/progression/me?limit=10')
      .set(authorization(playerToken))
      .expect(200);
    expect(summary.body).toEqual(
      expect.objectContaining({
        profile: expect.objectContaining({
          totalXp: 150,
          level: 2,
          currentLevelStartXp: 100,
          nextLevelXp: 400,
          xpIntoLevel: 50,
          xpToNextLevel: 250
        }),
        items: expect.any(Array),
        nextCursor: null,
        rules: expect.objectContaining({
          challengeCompletionXp: 50,
          minimumChallengeQuestions: 3
        })
      })
    );
    expect(summary.body.items).toHaveLength(3);
    expect(
      summary.body.items.every(
        (entry: { amount: number; source: string }) =>
          entry.amount === 50 && entry.source === 'CHALLENGE_COMPLETION'
      )
    ).toBe(true);

    const [projection, aggregate, ledgerCount] = await Promise.all([
      prisma.userProgression.findUnique({ where: { userId: playerId } }),
      prisma.xpLedgerEntry.aggregate({
        where: { userId: playerId },
        _sum: { amount: true }
      }),
      prisma.xpLedgerEntry.count({ where: { userId: playerId } })
    ]);
    expect(projection).toEqual(
      expect.objectContaining({ userId: playerId, totalXp: 150, level: 2 })
    );
    expect(aggregate._sum.amount).toBe(150);
    expect(ledgerCount).toBe(3);

    await request(app.getHttpServer())
      .post('/progression/me')
      .set(authorization(playerToken))
      .send({ amount: 100000 })
      .expect(404);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(authorization(playerToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.progression.profile).toEqual(
      expect.objectContaining({ userId: playerId, totalXp: 150, level: 2 })
    );
    expect(exported.body.progression.ledger).toHaveLength(3);

    await request(app.getHttpServer())
      .delete('/account')
      .set(authorization(playerToken))
      .send({ password: 'KnowMeTest123!' })
      .expect(200);
    expect(await prisma.xpLedgerEntry.count({ where: { userId: playerId } })).toBe(0);
    expect(await prisma.userProgression.count({ where: { userId: playerId } })).toBe(0);
  });
});
