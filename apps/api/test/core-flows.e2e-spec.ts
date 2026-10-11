import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe core flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mediaAlice: { userId: string; token: string };
  let mediaBob: { userId: string; token: string };
  let mediaCharlie: { userId: string; token: string };

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

    mediaCharlie = { userId: registration.body.user.id, token: registration.body.accessToken };

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

    mediaAlice = { userId: alice.body.user.id, token: alice.body.accessToken };
    mediaBob = { userId: bob.body.user.id, token: bob.body.accessToken };

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

  it('sends scanned conversation GIF and WebP sticker while forbidding cross-chat and foreign assets', async () => {
    // Reuse authenticated actors from preceding flow tests: avoid hitting
    // the shared anti-abuse registration limiter during the full CI suite.
    const alice = { body: { user: { id: mediaAlice.userId }, accessToken: mediaAlice.token } };
    const bob = { body: { user: { id: mediaBob.userId }, accessToken: mediaBob.token } };
    const charlie = { body: { user: { id: mediaCharlie.userId }, accessToken: mediaCharlie.token } };
    const header = (token: string) => `Bearer ${token}`;

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', header(alice.body.accessToken))
      .send({ memberIds: [bob.body.user.id] })
      .expect(201);
    const foreignConversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', header(alice.body.accessToken))
      .send({ memberIds: [charlie.body.user.id] })
      .expect(201);

    const makeAsset = (mime: string, status = 'AVAILABLE') => prisma.mediaAsset.create({
      data: {
        ownerId: alice.body.user.id,
        storageKey: `chatmedia-${mime.replace('/', '-')}-${Math.random().toString(36).slice(2)}`,
        originalName: mime === 'image/gif' ? 'animation.gif' : 'sticker.webp',
        declaredMime: mime,
        detectedMime: mime,
        size: 4096,
        sha256: 'a'.repeat(64),
        purpose: 'MESSAGE',
        visibility: 'CONVERSATION',
        conversationId: conversation.body.id,
        status,
        scannerVerdict: status === 'AVAILABLE' ? 'CLEAN' : 'UNAVAILABLE'
      }
    });
    const gif = await makeAsset('image/gif');
    const sticker = await makeAsset('image/webp');
    const blocked = await makeAsset('image/gif', 'QUARANTINED');

    const first = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/media-messages`)
      .set('Authorization', header(alice.body.accessToken))
      .send({ assetId: gif.id, kind: 'GIF' })
      .expect(201);
    expect(first.body.presentation).toMatchObject({
      kind: 'GIF', assetId: gif.id, mimeType: 'image/gif'
    });

    const second = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/media-messages`)
      .set('Authorization', header(alice.body.accessToken))
      .send({ assetId: sticker.id, kind: 'STICKER_IMAGE' })
      .expect(201);
    expect(second.body.presentation).toMatchObject({
      kind: 'STICKER_IMAGE', assetId: sticker.id
    });

    // Recipient can request a short-lived private download token; an outsider cannot.
    const recipientGrant = await request(app.getHttpServer())
      .post(`/media/${gif.id}/download-grant`)
      .set('Authorization', header(bob.body.accessToken))
      .expect(201);
    expect(recipientGrant.body.path).toContain(`/media/${gif.id}/content?token=`);

    await request(app.getHttpServer())
      .post(`/media/${gif.id}/download-grant`)
      .set('Authorization', header(charlie.body.accessToken))
      .expect(403);

    const history = await request(app.getHttpServer())
      .get(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', header(bob.body.accessToken))
      .expect(200);
    expect(history.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.body.id, presentation: expect.objectContaining({kind:'GIF'}) }),
      expect.objectContaining({ id: second.body.id, presentation: expect.objectContaining({kind:'STICKER_IMAGE'}) })
    ]));

    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/media-messages`)
      .set('Authorization', header(bob.body.accessToken))
      .send({ assetId: gif.id, kind: 'GIF' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/conversations/${foreignConversation.body.id}/media-messages`)
      .set('Authorization', header(alice.body.accessToken))
      .send({ assetId: gif.id, kind: 'GIF' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/media-messages`)
      .set('Authorization', header(alice.body.accessToken))
      .send({ assetId: blocked.id, kind: 'GIF' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/media-messages`)
      .set('Authorization', header(alice.body.accessToken))
      .send({ assetId: sticker.id, kind: 'GIF' })
      .expect(403);
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