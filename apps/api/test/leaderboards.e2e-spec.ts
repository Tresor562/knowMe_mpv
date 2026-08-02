import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe limited weekly leaderboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.leaderboardPreference.deleteMany();
    await prisma.userAchievementPreference.deleteMany();
    await prisma.achievementGrant.deleteMany();
    await prisma.achievementDefinition.deleteMany();
    await prisma.dailyQuestContribution.deleteMany();
    await prisma.dailyQuestProgress.deleteMany();
    await prisma.streakActivityDay.deleteMany();
    await prisma.userActivityStreak.deleteMany();
    await prisma.xpLedgerEntry.deleteMany();
    await prisma.userProgression.deleteMany();
    await prisma.privacyPreference.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@leaderboard.knowme.test`,
        username: `ranking_${label}`,
        displayName: `Ranking ${label}`,
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
        title: `Défi classement ${label}`,
        description: 'XP hebdomadaire issue du registre immuable.',
        questions: [
          `Question 1 ${label} ?`,
          `Question 2 ${label} ?`,
          `Question 3 ${label} ?`
        ]
      })
      .expect(201);
  }

  async function complete(
    creatorToken: string,
    playerToken: string,
    label: string
  ) {
    const challenge = await createChallenge(creatorToken, label);
    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set(authorization(playerToken))
      .expect(201);
    return request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/answers`)
      .set(authorization(playerToken))
      .send({
        answers: challenge.body.questions.map(
          (question: { id: string }, index: number) => ({
            questionId: question.id,
            value: `Réponse ${label} ${index + 1}`
          })
        )
      })
      .expect(201);
  }

  it('ranks only discoverable opt-in accounts from immutable weekly XP', async () => {
    const creator = await register('creator');
    const alpha = await register('alpha');
    const beta = await register('beta');
    const hidden = await register('hidden');

    const creatorToken = creator.body.accessToken as string;
    const alphaToken = alpha.body.accessToken as string;
    const betaToken = beta.body.accessToken as string;
    const hiddenToken = hidden.body.accessToken as string;
    const alphaId = alpha.body.user.id as string;
    const betaId = beta.body.user.id as string;
    const hiddenId = hidden.body.user.id as string;

    await Promise.all([
      prisma.privacyPreference.upsert({
        where: { userId: alphaId },
        create: { userId: alphaId, discoverability: true },
        update: { discoverability: true }
      }),
      prisma.privacyPreference.upsert({
        where: { userId: betaId },
        create: { userId: betaId, discoverability: true },
        update: { discoverability: true }
      }),
      prisma.privacyPreference.upsert({
        where: { userId: hiddenId },
        create: { userId: hiddenId, discoverability: false },
        update: { discoverability: false }
      })
    ]);

    const beforeOptIn = await request(app.getHttpServer())
      .get('/leaderboards/weekly')
      .set(authorization(alphaToken))
      .expect(200);
    expect(beforeOptIn.body.entries).toEqual([]);
    expect(beforeOptIn.body.self.reasonCode).toBe('OPT_IN_REQUIRED');

    await request(app.getHttpServer())
      .patch('/leaderboards/weekly/preferences')
      .set(authorization(alphaToken))
      .send({ enabled: true, displayAlias: 'Joueur Alpha', score: 999999 })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/leaderboards/weekly/preferences')
      .set(authorization(betaToken))
      .send({ enabled: true, displayAlias: 'Joueur Beta' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/leaderboards/weekly/preferences')
      .set(authorization(hiddenToken))
      .send({ enabled: true, displayAlias: 'Joueur Caché' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/leaderboards/weekly/preferences')
      .set(authorization(creatorToken))
      .send({ enabled: true, displayAlias: '**' })
      .expect(400);

    await complete(creatorToken, alphaToken, 'alpha-1');
    await complete(creatorToken, alphaToken, 'alpha-2');
    await complete(creatorToken, betaToken, 'beta-1');
    await complete(creatorToken, hiddenToken, 'hidden-1');
    await complete(creatorToken, hiddenToken, 'hidden-2');
    await complete(creatorToken, hiddenToken, 'hidden-3');

    const ranking = await request(app.getHttpServer())
      .get('/leaderboards/weekly')
      .set(authorization(betaToken))
      .expect(200);

    expect(ranking.body.entries).toEqual([
      expect.objectContaining({
        rank: 1,
        alias: 'Joueur Alpha',
        weeklyXp: 100,
        rankingXp: 100,
        isSelf: false
      }),
      expect.objectContaining({
        rank: 2,
        alias: 'Joueur Beta',
        weeklyXp: 50,
        rankingXp: 50,
        isSelf: true
      })
    ]);
    expect(ranking.body.entries).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ alias: 'Joueur Caché' })])
    );
    expect(ranking.body.self).toEqual(
      expect.objectContaining({ eligible: true, reasonCode: 'RANKED', rank: 2 })
    );
    expect(ranking.body.rules).toEqual(
      expect.objectContaining({
        optInRequired: true,
        discoverabilityRequired: true,
        maximumVisibleEntries: 50,
        weeklyRankingXpCap: 500,
        rewards: null,
        paidBoostsAllowed: false,
        scoreSource: 'IMMUTABLE_XP_LEDGER'
      })
    );

    await request(app.getHttpServer())
      .post('/leaderboards/weekly/score')
      .set(authorization(alphaToken))
      .send({ score: 1000000 })
      .expect(404);

    const optedOut = await request(app.getHttpServer())
      .patch('/leaderboards/weekly/preferences')
      .set(authorization(alphaToken))
      .send({ enabled: false })
      .expect(200);
    expect(optedOut.body.replayed).toBe(false);

    const optedOutReplay = await request(app.getHttpServer())
      .patch('/leaderboards/weekly/preferences')
      .set(authorization(alphaToken))
      .send({ enabled: false })
      .expect(200);
    expect(optedOutReplay.body.replayed).toBe(true);

    const afterOptOut = await request(app.getHttpServer())
      .get('/leaderboards/weekly')
      .set(authorization(betaToken))
      .expect(200);
    expect(afterOptOut.body.entries).toEqual([
      expect.objectContaining({ alias: 'Joueur Beta', rank: 1 })
    ]);

    expect(
      await prisma.auditLog.count({
        where: { actorId: alphaId, action: 'LEADERBOARD_WEEKLY_OPT_OUT' }
      })
    ).toBe(1);

    await prisma.privacyPreference.update({
      where: { userId: betaId },
      data: { discoverability: false }
    });
    const afterPrivacyChange = await request(app.getHttpServer())
      .get('/leaderboards/weekly')
      .set(authorization(betaToken))
      .expect(200);
    expect(afterPrivacyChange.body.entries).toEqual([]);
    expect(afterPrivacyChange.body.self.reasonCode).toBe('DISCOVERABILITY_DISABLED');

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(authorization(alphaToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.leaderboards.weeklyXpPreference).toEqual(
      expect.objectContaining({
        userId: alphaId,
        weeklyXpEnabled: false,
        displayAlias: 'Joueur Alpha'
      })
    );

    await request(app.getHttpServer())
      .delete('/account')
      .set(authorization(alphaToken))
      .send({ password: 'KnowMeTest123!' })
      .expect(200);
    expect(await prisma.leaderboardPreference.count({ where: { userId: alphaId } })).toBe(0);
  });
});
