import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe healthy activity streaks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.streakActivityDay.deleteMany();
    await prisma.userActivityStreak.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@streaks.knowme.test`,
        username: `streak_${label}`,
        displayName: `Streak ${label}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  function authorization(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createChallenge(token: string, label: string) {
    return request(app.getHttpServer())
      .post('/challenges')
      .set(authorization(token))
      .send({
        title: `Défi série ${label}`,
        description: 'Validation des séries saines.',
        questions: ['Question une ?', 'Question deux ?', 'Question trois ?']
      })
      .expect(201);
  }

  function answer(
    token: string,
    challenge: { id: string; questions: Array<{ id: string }> },
    label: string
  ) {
    return request(app.getHttpServer())
      .post(`/challenges/${challenge.id}/answers`)
      .set(authorization(token))
      .send({
        answers: challenge.questions.map((question, index) => ({
          questionId: question.id,
          value: `${label}-${index + 1}`
        }))
      });
  }

  it('credits one immutable UTC day and never exposes a write endpoint', async () => {
    const creator = await register('creator');
    const player = await register('player');
    const creatorToken = creator.body.accessToken as string;
    const playerToken = player.body.accessToken as string;
    const creatorId = creator.body.user.id as string;
    const playerId = player.body.user.id as string;

    const first = await createChallenge(creatorToken, 'premier');
    const selfCompletion = await answer(
      creatorToken,
      first.body,
      'créateur'
    ).expect(201);
    expect(selfCompletion.body.streak).toEqual(
      expect.objectContaining({ credited: false, reasonCode: 'SELF_CHALLENGE' })
    );
    expect(
      await prisma.streakActivityDay.count({ where: { userId: creatorId } })
    ).toBe(0);

    await request(app.getHttpServer())
      .post(`/challenges/${first.body.id}/join`)
      .set(authorization(playerToken))
      .expect(201);
    const firstCompletion = await answer(playerToken, first.body, 'joueur').expect(201);
    expect(firstCompletion.body.streak).toEqual(
      expect.objectContaining({
        credited: true,
        replayed: false,
        reasonCode: 'DAY_CREDITED',
        profile: expect.objectContaining({ currentDays: 1, longestDays: 1 })
      })
    );

    const replay = await answer(playerToken, first.body, 'rejeu').expect(201);
    expect(replay.body.streak).toEqual(
      expect.objectContaining({ credited: false, replayed: true, reasonCode: 'REPLAYED' })
    );

    const second = await createChallenge(creatorToken, 'second');
    await answer(creatorToken, second.body, 'créateur-2').expect(201);
    await request(app.getHttpServer())
      .post(`/challenges/${second.body.id}/join`)
      .set(authorization(playerToken))
      .expect(201);
    const secondCompletion = await answer(playerToken, second.body, 'joueur-2').expect(201);
    expect(secondCompletion.body.streak).toEqual(
      expect.objectContaining({
        credited: false,
        replayed: false,
        reasonCode: 'DAY_ALREADY_CREDITED',
        profile: expect.objectContaining({ currentDays: 1, longestDays: 1 })
      })
    );

    expect(
      await prisma.streakActivityDay.count({ where: { userId: playerId } })
    ).toBe(1);
    expect(
      await prisma.userActivityStreak.findUnique({ where: { userId: playerId } })
    ).toEqual(
      expect.objectContaining({ currentDays: 1, longestDays: 1 })
    );

    const summary = await request(app.getHttpServer())
      .get('/streaks/me')
      .set(authorization(playerToken))
      .expect(200);
    expect(summary.body).toEqual(
      expect.objectContaining({
        profile: expect.objectContaining({ currentDays: 1, longestDays: 1 }),
        days: [
          expect.objectContaining({
            userId: playerId,
            source: 'CHALLENGE_COMPLETION'
          })
        ],
        rules: expect.objectContaining({
          timezone: 'UTC',
          oneCreditPerDay: true,
          allowedMissedDays: 1,
          purchasesAffectStreak: false
        })
      })
    );

    await request(app.getHttpServer())
      .post('/streaks/me')
      .set(authorization(playerToken))
      .send({ currentDays: 999 })
      .expect(404);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(authorization(playerToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.streaks.profile).toEqual(
      expect.objectContaining({ userId: playerId, currentDays: 1, longestDays: 1 })
    );
    expect(exported.body.streaks.days).toHaveLength(1);

    await request(app.getHttpServer())
      .delete('/account')
      .set(authorization(playerToken))
      .send({ password: 'KnowMeTest123!' })
      .expect(200);
    expect(
      await prisma.streakActivityDay.count({ where: { userId: playerId } })
    ).toBe(0);
    expect(
      await prisma.userActivityStreak.count({ where: { userId: playerId } })
    ).toBe(0);
  });
});
