import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative daily quests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.dailyQuestContribution.deleteMany();
    await prisma.dailyQuestProgress.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@quests.knowme.test`,
        username: `quest_${label}`,
        displayName: `Quest ${label}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createChallenge(token: string) {
    return request(app.getHttpServer())
      .post('/challenges')
      .set(auth(token))
      .send({
        title: 'Quête quotidienne autoritaire',
        description: 'Une seule contribution serveur doit compter.',
        questions: ['Question 1 ?', 'Question 2 ?', 'Question 3 ?']
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
      .set(auth(token))
      .send({
        answers: challenge.questions.map((question, index) => ({
          questionId: question.id,
          value: `${label}-${index + 1}`
        }))
      });
  }

  it('completes once, rejects farming and removes all quest data with the account', async () => {
    const creator = await register('creator');
    const player = await register('player');
    const creatorToken = creator.body.accessToken as string;
    const playerToken = player.body.accessToken as string;
    const creatorId = creator.body.user.id as string;
    const playerId = player.body.user.id as string;
    const challenge = await createChallenge(creatorToken);

    const self = await answer(creatorToken, challenge.body, 'creator').expect(201);
    expect(self.body.quest).toEqual(
      expect.objectContaining({ completedNow: false, reasonCode: 'SELF_CHALLENGE' })
    );
    expect(
      await prisma.dailyQuestContribution.count({ where: { userId: creatorId } })
    ).toBe(0);

    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set(auth(playerToken))
      .expect(201);

    const completion = await answer(playerToken, challenge.body, 'player').expect(201);
    expect(completion.body.quest).toEqual(
      expect.objectContaining({
        completedNow: true,
        replayed: false,
        reasonCode: 'QUEST_COMPLETED',
        quest: expect.objectContaining({
          key: 'daily_challenge_explorer',
          target: 1,
          progress: 1,
          status: 'COMPLETED'
        })
      })
    );

    const replay = await answer(playerToken, challenge.body, 'replay').expect(201);
    expect(replay.body.quest).toEqual(
      expect.objectContaining({
        completedNow: false,
        replayed: true,
        reasonCode: 'REPLAYED'
      })
    );
    expect(
      await prisma.dailyQuestContribution.count({ where: { userId: playerId } })
    ).toBe(1);

    const today = await request(app.getHttpServer())
      .get('/quests/today')
      .set(auth(playerToken))
      .expect(200);
    expect(today.body).toEqual(
      expect.objectContaining({
        quest: expect.objectContaining({ progress: 1, status: 'COMPLETED' }),
        rules: expect.objectContaining({
          timezone: 'UTC',
          automaticCompletion: true,
          manualClaimRequired: false,
          paidBoostsAllowed: false,
          reward: null
        })
      })
    );

    await request(app.getHttpServer())
      .post('/quests/today')
      .set(auth(playerToken))
      .send({ progress: 999 })
      .expect(404);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(auth(playerToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.quests.progress).toHaveLength(1);
    expect(exported.body.quests.contributions).toHaveLength(1);

    await request(app.getHttpServer())
      .delete('/account')
      .set(auth(playerToken))
      .send({ password: 'KnowMeTest123!' })
      .expect(200);
    expect(
      await prisma.dailyQuestProgress.count({ where: { userId: playerId } })
    ).toBe(0);
    expect(
      await prisma.dailyQuestContribution.count({ where: { userId: playerId } })
    ).toBe(0);
  });
});
