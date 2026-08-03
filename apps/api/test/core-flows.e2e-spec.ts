import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe core flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" CASCADE'
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and returns the authenticated profile', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'sprint2@knowme.test',
        username: 'sprint2_user',
        displayName: 'Sprint Two',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    expect(registration.body.accessToken).toEqual(expect.any(String));
    expect(registration.body.refreshToken).toEqual(expect.any(String));
    expect(registration.body.user.username).toBe('sprint2_user');

    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${registration.body.accessToken}`)
      .expect(200);

    expect(profile.body).toMatchObject({
      email: 'sprint2@knowme.test',
      username: 'sprint2_user',
      displayName: 'Sprint Two'
    });
  });

  it('creates and lists an authenticated challenge', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'sprint2_user',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const token = login.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/challenges')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Qui me connaît vraiment ?',
        description: 'Premier parcours intégré du Sprint 2.',
        questions: [
          'Quel est mon objectif principal ?',
          'Quelle activité me motive le plus ?'
        ]
      })
      .expect(201);

    expect(created.body.title).toBe('Qui me connaît vraiment ?');
    expect(created.body.questions).toHaveLength(2);
    expect(created.body.participants).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/challenges')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id })
      ])
    );
  });

  it('connects two users and exchanges a message', async () => {
    const alice = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'alice@knowme.test',
        username: 'alice_s2',
        displayName: 'Alice',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const bob = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'bob@knowme.test',
        username: 'bob_s2',
        displayName: 'Bob',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const friendRequest = await request(app.getHttpServer())
      .post('/social/friend-requests')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ addresseeId: bob.body.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${friendRequest.body.id}/accept`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const friends = await request(app.getHttpServer())
      .get('/social/friends')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(friends.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user: expect.objectContaining({ id: bob.body.user.id })
        })
      ])
    );

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({
        title: 'Alice et Bob',
        memberIds: [bob.body.user.id]
      })
      .expect(201);

    const message = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'Salut Bob, bienvenue sur KnowMe !' })
      .expect(201);

    expect(message.body).toMatchObject({
      content: 'Salut Bob, bienvenue sur KnowMe !',
      senderId: alice.body.user.id
    });

    const conversations = await request(app.getHttpServer())
      .get('/conversations')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(conversations.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: conversation.body.id })
      ])
    );
  });

  it('sends an idempotent visual gift with one KnowCoin debit and one receipt', async () => {
    const sender = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'gift-sender@knowme.test',
        username: 'gift_sender',
        displayName: 'Gift Sender',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const recipient = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'gift-recipient@knowme.test',
        username: 'gift_recipient',
        displayName: 'Gift Recipient',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const friendship = await request(app.getHttpServer())
      .post('/social/friend-requests')
      .set('Authorization', `Bearer ${sender.body.accessToken}`)
      .send({ addresseeId: recipient.body.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${friendship.body.id}/accept`)
      .set('Authorization', `Bearer ${recipient.body.accessToken}`)
      .expect(200);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: sender.body.user.id },
        data: { knowCoins: 100 }
      }),
      prisma.knowCoinWallet.upsert({
        where: { userId: sender.body.user.id },
        create: { userId: sender.body.user.id, balance: 100 },
        update: { balance: 100 }
      })
    ]);

    const idempotencyKey = 'gift:e2e:recipient:spark:00000001';
    const first = await request(app.getHttpServer())
      .post('/social/gifts')
      .set('Authorization', `Bearer ${sender.body.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        recipientId: recipient.body.user.id,
        giftKey: 'spark',
        message: 'Bravo pour ton progrès !'
      })
      .expect(201);

    expect(first.body).toMatchObject({
      gift: {
        key: 'spark',
        priceKnowCoins: 25,
        visualOnly: true,
        redeemable: false,
        transferable: false,
        gameplayEffectsAllowed: false
      },
      recipientId: recipient.body.user.id,
      senderBalance: 75,
      replayed: false,
      recipientBalanceCredited: false,
      immutableReceipt: true
    });

    const replay = await request(app.getHttpServer())
      .post('/social/gifts')
      .set('Authorization', `Bearer ${sender.body.accessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        recipientId: recipient.body.user.id,
        giftKey: 'spark',
        message: 'Bravo pour ton progrès !'
      })
      .expect(201);

    expect(replay.body).toMatchObject({
      giftId: first.body.giftId,
      senderBalance: 75,
      replayed: true
    });

    const wallet = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${sender.body.accessToken}`)
      .expect(200);
    expect(wallet.body.balance).toBe(75);

    const inbox = await request(app.getHttpServer())
      .get('/social/gifts/inbox')
      .set('Authorization', `Bearer ${recipient.body.accessToken}`)
      .expect(200);

    expect(inbox.body.items).toEqual([
      expect.objectContaining({
        id: first.body.giftId,
        gift: expect.objectContaining({ key: 'spark', priceKnowCoins: 25 }),
        sender: expect.objectContaining({ id: sender.body.user.id }),
        message: 'Bravo pour ton progrès !',
        viewedAt: null,
        visualOnly: true,
        redeemable: false,
        transferable: false
      })
    ]);

    expect(
      await prisma.knowCoinLedgerEntry.count({
        where: { idempotencyKey }
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { id: first.body.giftId, userId: recipient.body.user.id }
      })
    ).toBe(1);
    expect(
      await prisma.user.findUnique({
        where: { id: recipient.body.user.id },
        select: { knowCoins: true }
      })
    ).toEqual({ knowCoins: 0 });
  });
});