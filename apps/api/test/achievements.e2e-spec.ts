import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative badges and titles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.userAchievementPreference.deleteMany();
    await prisma.achievementGrant.deleteMany();
    await prisma.achievementDefinition.deleteMany();
    await prisma.dailyQuestContribution.deleteMany();
    await prisma.dailyQuestProgress.deleteMany();
    await prisma.streakActivityDay.deleteMany();
    await prisma.userActivityStreak.deleteMany();
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
        email: `${label}@achievements.knowme.test`,
        username: `achievement_${label}`,
        displayName: `Achievement ${label}`,
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
        title: `Défi mérite ${label}`,
        description: 'Validation des badges et titres autoritaires.',
        questions: [
          `Question 1 ${label} ?`,
          `Question 2 ${label} ?`,
          `Question 3 ${label} ?`
        ]
      })
      .expect(201);
  }

  async function join(token: string, challengeId: string) {
    return request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(authorization(token))
      .expect(201);
  }

  function answer(
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

  it('grants immutable merit, protects title choice and audits revocation', async () => {
    const admin = await register('admin');
    const creator = await register('creator');
    const player = await register('player');
    const stranger = await register('stranger');

    await prisma.user.update({
      where: { id: admin.body.user.id },
      data: { role: 'ADMIN' }
    });

    const adminToken = admin.body.accessToken as string;
    const creatorToken = creator.body.accessToken as string;
    const playerToken = player.body.accessToken as string;
    const strangerToken = stranger.body.accessToken as string;
    const playerId = player.body.user.id as string;

    const first = await createChallenge(creatorToken, 'first');
    await join(playerToken, first.body.id);
    const firstCompletion = await answer(playerToken, first.body, 'first').expect(201);

    expect(firstCompletion.body.achievements).toEqual(
      expect.objectContaining({
        reasonCode: 'ACHIEVEMENTS_GRANTED',
        grantedNow: expect.arrayContaining([
          expect.objectContaining({
            definition: expect.objectContaining({ key: 'first_challenge', type: 'BADGE' })
          }),
          expect.objectContaining({
            definition: expect.objectContaining({ key: 'explorer', type: 'TITLE' })
          })
        ])
      })
    );

    const replay = await answer(playerToken, first.body, 'replay').expect(201);
    expect(replay.body.achievements.grantedNow).toEqual([]);
    expect(replay.body.achievements.replayed).toHaveLength(2);
    expect(await prisma.achievementGrant.count({ where: { userId: playerId } })).toBe(2);

    const initialSummary = await request(app.getHttpServer())
      .get('/achievements/me')
      .set(authorization(playerToken))
      .expect(200);
    expect(initialSummary.body.badges).toHaveLength(1);
    expect(initialSummary.body.titles).toHaveLength(1);
    expect(initialSummary.body.selectedTitle).toBeNull();
    expect(initialSummary.body.rules).toEqual(
      expect.objectContaining({
        serverAuthoritative: true,
        paidMeritAllowed: false,
        verificationSeparation: true,
        staffSeparation: true,
        premiumSeparation: true
      })
    );

    const explorerTitle = initialSummary.body.titles.find(
      (grant: { definition: { key: string } }) => grant.definition.key === 'explorer'
    );
    expect(explorerTitle).toBeDefined();

    const selected = await request(app.getHttpServer())
      .patch('/achievements/title')
      .set(authorization(playerToken))
      .send({ grantId: explorerTitle.id })
      .expect(200);
    expect(selected.body.selectedTitle.definition.key).toBe('explorer');

    await request(app.getHttpServer())
      .patch('/achievements/title')
      .set(authorization(strangerToken))
      .send({ grantId: explorerTitle.id })
      .expect(400);

    const second = await createChallenge(creatorToken, 'second');
    await join(playerToken, second.body.id);
    const secondCompletion = await answer(playerToken, second.body, 'second').expect(201);
    expect(secondCompletion.body.progression.profile).toEqual(
      expect.objectContaining({ totalXp: 100, level: 2 })
    );
    expect(secondCompletion.body.achievements.grantedNow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          definition: expect.objectContaining({ key: 'level_two', type: 'BADGE' })
        }),
        expect.objectContaining({
          definition: expect.objectContaining({ key: 'curious_mind', type: 'TITLE' })
        })
      ])
    );
    expect(await prisma.achievementGrant.count({ where: { userId: playerId } })).toBe(4);

    const concurrent = await createChallenge(creatorToken, 'concurrent');
    await join(playerToken, concurrent.body.id);
    const concurrentResponses = await Promise.all([
      answer(playerToken, concurrent.body, 'A'),
      answer(playerToken, concurrent.body, 'B')
    ]);
    expect(concurrentResponses.map((response) => response.status)).toEqual([201, 201]);
    expect(await prisma.achievementGrant.count({ where: { userId: playerId } })).toBe(4);

    await request(app.getHttpServer())
      .post('/achievements/grants')
      .set(authorization(playerToken))
      .send({ key: 'verified', type: 'BADGE' })
      .expect(404);

    const revoked = await request(app.getHttpServer())
      .patch(`/admin/achievements/grants/${explorerTitle.id}/revoke`)
      .set(authorization(adminToken))
      .send({ reason: 'Révocation de validation E2E.' })
      .expect(200);
    expect(revoked.body).toEqual(
      expect.objectContaining({
        replayed: false,
        grant: expect.objectContaining({ revokedAt: expect.any(String) })
      })
    );

    const revokedReplay = await request(app.getHttpServer())
      .patch(`/admin/achievements/grants/${explorerTitle.id}/revoke`)
      .set(authorization(adminToken))
      .send({ reason: 'Tentative rejouée.' })
      .expect(200);
    expect(revokedReplay.body.replayed).toBe(true);

    const afterRevocation = await request(app.getHttpServer())
      .get('/achievements/me')
      .set(authorization(playerToken))
      .expect(200);
    expect(afterRevocation.body.selectedTitle).toBeNull();
    expect(afterRevocation.body.titles).toHaveLength(1);
    expect(afterRevocation.body.history).toHaveLength(4);

    expect(
      await prisma.auditLog.count({
        where: {
          action: 'ACHIEVEMENT_REVOKE',
          entityId: explorerTitle.id
        }
      })
    ).toBe(1);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(authorization(playerToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.achievements.grants).toHaveLength(4);
    expect(exported.body.achievements.preference.selectedTitleGrantId).toBeNull();

    await request(app.getHttpServer())
      .delete('/account')
      .set(authorization(playerToken))
      .send({ password: 'KnowMeTest123!' })
      .expect(200);
    expect(await prisma.achievementGrant.count({ where: { userId: playerId } })).toBe(0);
    expect(
      await prisma.userAchievementPreference.count({ where: { userId: playerId } })
    ).toBe(0);
  });
});
