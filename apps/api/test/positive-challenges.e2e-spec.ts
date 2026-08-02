import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe positive challenges (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let account: AccountService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    account = app.get(AccountService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(name: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${name}@positive.knowme.test`,
        username: `positive_${name}`,
        displayName: `Positive ${name}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('requires friendship, explicit consent and two independent confirmations', async () => {
    const creator = await register('creator');
    const recipient = await register('recipient');
    const outsider = await register('outsider');
    const creatorToken = creator.body.accessToken as string;
    const recipientToken = recipient.body.accessToken as string;
    const outsiderToken = outsider.body.accessToken as string;
    const creatorId = creator.body.user.id as string;
    const recipientId = recipient.body.user.id as string;

    const catalog = await request(app.getHttpServer())
      .get('/positive-challenges/catalog')
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
    expect(catalog.body.rules).toEqual(
      expect.objectContaining({
        friendsOnly: true,
        explicitConsent: true,
        refusalPenalty: false,
        doubleConfirmation: true,
        reward: null,
        paidBoostsAllowed: false
      })
    );

    await request(app.getHttpServer())
      .post('/positive-challenges')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ recipientId, kind: 'GRATITUDE_NOTE' })
      .expect(403);

    const friendship = await request(app.getHttpServer())
      .post('/social/friend-requests')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ addresseeId: recipientId })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${friendship.body.id}/accept`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);

    const [first, duplicate] = await Promise.all([
      request(app.getHttpServer())
        .post('/positive-challenges')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          recipientId,
          kind: 'GRATITUDE_NOTE',
          note: 'Merci pour ton soutien.'
        }),
      request(app.getHttpServer())
        .post('/positive-challenges')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          recipientId,
          kind: 'GRATITUDE_NOTE',
          note: 'Ce doublon doit être rejoué.'
        })
    ]);
    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(201);
    expect([first.body.replayed, duplicate.body.replayed].sort()).toEqual([false, true]);
    expect(first.body.id).toBe(duplicate.body.id);

    const challengeId = first.body.id as string;
    expect(await prisma.positiveChallenge.count({ where: { id: challengeId } })).toBe(1);
    expect(
      await prisma.positiveChallengeEvent.count({
        where: { challengeId, type: 'INVITED' }
      })
    ).toBe(1);

    await request(app.getHttpServer())
      .patch(`/positive-challenges/${challengeId}/accept`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);

    const accepted = await request(app.getHttpServer())
      .patch(`/positive-challenges/${challengeId}/accept`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);
    expect(accepted.body.status).toBe('ACCEPTED');

    const creatorConfirmation = await request(app.getHttpServer())
      .patch(`/positive-challenges/${challengeId}/confirm`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
    expect(creatorConfirmation.body.status).toBe('COMPLETION_PENDING');

    const recipientConfirmation = await request(app.getHttpServer())
      .patch(`/positive-challenges/${challengeId}/confirm`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);
    expect(recipientConfirmation.body.status).toBe('COMPLETED');
    expect(recipientConfirmation.body.replayed).toBe(false);

    const confirmationReplay = await request(app.getHttpServer())
      .patch(`/positive-challenges/${challengeId}/confirm`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);
    expect(confirmationReplay.body.replayed).toBe(true);

    expect(await prisma.xpLedgerEntry.count({ where: { userId: recipientId } })).toBe(0);
    expect(await prisma.knowCoinLedgerEntry.count({ where: { userId: recipientId } })).toBe(0);

    const second = await request(app.getHttpServer())
      .post('/positive-challenges')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ recipientId, kind: 'ENCOURAGEMENT' })
      .expect(201);
    const declined = await request(app.getHttpServer())
      .patch(`/positive-challenges/${second.body.id}/decline`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);
    expect(declined.body.status).toBe('DECLINED');

    const listing = await request(app.getHttpServer())
      .get('/positive-challenges/me')
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);
    expect(listing.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: challengeId, status: 'COMPLETED' }),
        expect.objectContaining({ id: second.body.id, status: 'DECLINED' })
      ])
    );

    const exported = await account.exportData(recipientId);
    expect(exported.positiveChallenges.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: challengeId, status: 'COMPLETED' })
      ])
    );

    expect(
      await prisma.auditLog.count({
        where: {
          entity: 'PositiveChallenge',
          entityId: challengeId
        }
      })
    ).toBeGreaterThanOrEqual(4);

    await account.deleteAccount(recipientId, { password: 'KnowMeTest123!' });
    expect(
      await prisma.positiveChallenge.count({
        where: { OR: [{ creatorId }, { recipientId }] }
      })
    ).toBe(0);
  });
});
