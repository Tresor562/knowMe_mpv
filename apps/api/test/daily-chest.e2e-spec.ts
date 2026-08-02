import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe deterministic daily chest (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.dailyChestClaim.deleteMany();
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
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@daily-chest.knowme.test`,
        username: `chest_${label}`,
        displayName: `Chest ${label}`,
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
        title: `Défi coffre ${label}`,
        description: 'Déverrouillage déterministe après la quête quotidienne.',
        questions: [
          `Question 1 ${label} ?`,
          `Question 2 ${label} ?`,
          `Question 3 ${label} ?`
        ]
      })
      .expect(201);
  }

  async function answer(
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
      })
      .expect(201);
  }

  it('credits one fixed chest only after the daily quest', async () => {
    const creator = await register('creator');
    const player = await register('player');
    const selfPlayer = await register('self');

    const creatorToken = creator.body.accessToken as string;
    const playerToken = player.body.accessToken as string;
    const selfToken = selfPlayer.body.accessToken as string;
    const playerId = player.body.user.id as string;
    const selfId = selfPlayer.body.user.id as string;

    const locked = await request(app.getHttpServer())
      .get('/daily-chest/today')
      .set(authorization(playerToken))
      .expect(200);
    expect(locked.body).toEqual(
      expect.objectContaining({
        eligible: false,
        claimed: false,
        canClaim: false,
        currentBalance: 0,
        rules: expect.objectContaining({
          amount: 10,
          deterministic: true,
          randomReward: false,
          purchaseRequired: false,
          premiumBoostAllowed: false,
          streakPenalty: false,
          oneClaimPerUtcDay: true
        })
      })
    );

    await request(app.getHttpServer())
      .post('/daily-chest/claim')
      .set(authorization(playerToken))
      .send({ amount: 999999, rarity: 'LEGENDARY' })
      .expect(400);

    const challenge = await createChallenge(creatorToken, 'eligible');
    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set(authorization(playerToken))
      .expect(201);
    const completion = await answer(playerToken, challenge.body, 'eligible');
    expect(completion.body.quest.quest.status).toBe('COMPLETED');

    const unlocked = await request(app.getHttpServer())
      .get('/daily-chest/today')
      .set(authorization(playerToken))
      .expect(200);
    expect(unlocked.body).toEqual(
      expect.objectContaining({
        eligible: true,
        claimed: false,
        canClaim: true,
        currentBalance: 25
      })
    );

    const claims = await Promise.all([
      request(app.getHttpServer())
        .post('/daily-chest/claim')
        .set(authorization(playerToken))
        .send({ amount: 10 }),
      request(app.getHttpServer())
        .post('/daily-chest/claim')
        .set(authorization(playerToken))
        .send({ amount: 1000000 })
    ]);
    expect(claims.map((response) => response.status)).toEqual([201, 201]);
    expect(claims.filter((response) => response.body.replayed === false)).toHaveLength(1);
    expect(claims.filter((response) => response.body.replayed === true)).toHaveLength(1);

    const [claimRows, chestLedger, wallet, auditCount] = await Promise.all([
      prisma.dailyChestClaim.findMany({ where: { userId: playerId } }),
      prisma.knowCoinLedgerEntry.findMany({
        where: { userId: playerId, source: 'DAILY_CHEST' }
      }),
      prisma.knowCoinWallet.findUnique({ where: { userId: playerId } }),
      prisma.auditLog.count({
        where: { actorId: playerId, action: 'DAILY_CHEST_CLAIM' }
      })
    ]);
    expect(claimRows).toHaveLength(1);
    expect(claimRows[0]).toEqual(
      expect.objectContaining({ amount: 10, status: 'CLAIMED' })
    );
    expect(chestLedger).toHaveLength(1);
    expect(chestLedger[0]).toEqual(
      expect.objectContaining({
        amount: 10,
        type: 'DAILY_CHEST_CREDIT',
        source: 'DAILY_CHEST',
        balanceBefore: 25,
        balanceAfter: 35
      })
    );
    expect(wallet?.balance).toBe(35);
    expect(auditCount).toBe(1);

    const claimed = await request(app.getHttpServer())
      .get('/daily-chest/today')
      .set(authorization(playerToken))
      .expect(200);
    expect(claimed.body).toEqual(
      expect.objectContaining({
        eligible: true,
        claimed: true,
        canClaim: false,
        currentBalance: 35,
        claim: expect.objectContaining({ amount: 10 })
      })
    );

    const selfChallenge = await createChallenge(selfToken, 'self');
    await answer(selfToken, selfChallenge.body, 'self');
    await request(app.getHttpServer())
      .post('/daily-chest/claim')
      .set(authorization(selfToken))
      .expect(400);
    expect(await prisma.dailyChestClaim.count({ where: { userId: selfId } })).toBe(0);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(authorization(playerToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.dailyChest.claims).toHaveLength(1);
    expect(exported.body.dailyChest.claims[0].amount).toBe(10);

    await request(app.getHttpServer())
      .delete('/account')
      .set(authorization(playerToken))
      .send({ password: 'KnowMeTest123!' })
      .expect(200);
    expect(await prisma.dailyChestClaim.count({ where: { userId: playerId } })).toBe(0);
    expect(
      await prisma.knowCoinLedgerEntry.count({
        where: { userId: playerId, source: 'DAILY_CHEST' }
      })
    ).toBe(0);
  });
});
