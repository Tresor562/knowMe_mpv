import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KMD-060 secure short links (e2e)', () => {
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

    await prisma.shortLinkReceipt.deleteMany();
    await prisma.shortLink.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.featureFlag.upsert({
      where: { key: 'short_links.creation' },
      create: {
        key: 'short_links.creation',
        description: 'KMD-060 e2e',
        enabled: true,
        exposeToClient: false,
        riskLevel: 'HIGH',
        owner: 'CI'
      },
      update: { enabled: true }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  function auth(response: Awaited<ReturnType<typeof register>>) {
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  it('creates idempotently, resolves minimally, aggregates usage and revokes fail-closed', async () => {
    const alice = await register(
      'short-alice@knowme.test',
      'short_alice',
      'Short Alice'
    );
    const payload = {
      targetType: 'PROFILE',
      targetId: 'short_alice',
      idempotencyKey: 'short:create:alice:0001'
    };

    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(alice))
      .send(payload)
      .expect(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        code: expect.stringMatching(/^[A-Za-z0-9_-]{10,20}$/),
        shortPath: expect.stringMatching(/^\/s\/[A-Za-z0-9_-]+$/),
        targetType: 'PROFILE',
        targetId: 'short_alice',
        webPath: '/profile/short_alice',
        deepLink: 'knowme://profile/short_alice',
        revokedAt: null
      })
    );
    expect(JSON.stringify(created.body)).not.toContain('ownerId');

    const replay = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(alice))
      .send(payload)
      .expect(201);
    expect(replay.body.id).toBe(created.body.id);
    expect(await prisma.shortLink.count()).toBe(1);

    await request(app.getHttpServer())
      .get(`/short-links/resolve/${created.body.code}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          code: created.body.code,
          targetType: 'PROFILE',
          webPath: '/profile/short_alice',
          deepLink: 'knowme://profile/short_alice',
          expiresAt: null
        });
        expect(response.body).not.toHaveProperty('id');
        expect(response.body).not.toHaveProperty('targetId');
        expect(response.body).not.toHaveProperty('ownerId');
      });

    const mine = await request(app.getHttpServer())
      .get('/short-links/me')
      .set(auth(alice))
      .expect(200);
    expect(mine.body[0].resolveCount).toBe(1);

    const revoked = await request(app.getHttpServer())
      .post(`/short-links/${created.body.id}/revoke`)
      .set(auth(alice))
      .send({ idempotencyKey: 'short:revoke:alice:0001' })
      .expect(201);
    expect(revoked.body.revokedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get(`/short-links/resolve/${created.body.code}`)
      .expect(404);
  });

  it('fails closed for an expired link without exposing a different oracle', async () => {
    const user = await register(
      'short-expiry@knowme.test',
      'short_expiry',
      'Short Expiry'
    );
    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(user))
      .send({
        targetType: 'PROFILE',
        targetId: 'short_expiry',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        idempotencyKey: 'short:create:expiry:0001'
      })
      .expect(201);

    await prisma.shortLink.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });

    const response = await request(app.getHttpServer())
      .get(`/short-links/resolve/${created.body.code}`)
      .expect(404);
    expect(response.body.message).toBe('Lien indisponible.');
  });

  it('rejects external-looking targets before persistence', async () => {
    const bob = await register('short-bob@knowme.test', 'short_bob', 'Short Bob');

    await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(bob))
      .send({
        targetType: 'PROFILE',
        targetId: 'javascript:alert(1)',
        idempotencyKey: 'short:create:bob:0001'
      })
      .expect(400);

    expect(await prisma.shortLink.count({ where: { ownerId: bob.body.user.id } })).toBe(0);
  });

  it('authorizes a real group and rechecks membership on every public resolution', async () => {
    const owner = await register(
      'short-owner@knowme.test',
      'short_owner',
      'Short Owner'
    );
    const memberA = await register(
      'short-member-a@knowme.test',
      'short_member_a',
      'Short Member A'
    );
    const memberB = await register(
      'short-member-b@knowme.test',
      'short_member_b',
      'Short Member B'
    );
    const outsider = await register(
      'short-outsider@knowme.test',
      'short_outsider',
      'Short Outsider'
    );

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set(auth(owner))
      .send({
        title: 'KMD-060 group',
        memberIds: [memberA.body.user.id, memberB.body.user.id]
      })
      .expect(201);
    expect(conversation.body.isGroup).toBe(true);

    const memberLink = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(memberA))
      .send({
        targetType: 'GROUP',
        targetId: conversation.body.id,
        idempotencyKey: 'short:create:member-a:0001'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(outsider))
      .send({
        targetType: 'GROUP',
        targetId: conversation.body.id,
        idempotencyKey: 'short:create:outsider:0001'
      })
      .expect(403);

    await prisma.conversationMember.delete({
      where: {
        conversationId_userId: {
          conversationId: conversation.body.id,
          userId: memberA.body.user.id
        }
      }
    });

    const unavailable = await request(app.getHttpServer())
      .get(`/short-links/resolve/${memberLink.body.code}`)
      .expect(404);
    expect(unavailable.body.message).toBe('Lien indisponible.');
  });

  it('keeps unresolved target families closed until ownership is bound', async () => {
    const user = await register(
      'short-closed@knowme.test',
      'short_closed',
      'Short Closed'
    );

    for (const targetType of ['EVENT', 'STICKER_PACK']) {
      await request(app.getHttpServer())
        .post('/short-links')
        .set(auth(user))
        .send({
          targetType,
          targetId: 'future-target-001',
          idempotencyKey: `short:closed:${targetType}:0001`
        })
        .expect(403);
    }
  });

  it('canonicalizes aliases, exports owned links and deletes links plus receipts with the account', async () => {
    const user = await register(
      'short-lifecycle@knowme.test',
      'short_lifecycle',
      'Short Lifecycle'
    );
    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(user))
      .send({
        targetType: 'PROFILE',
        targetId: user.body.user.id,
        idempotencyKey: 'short:create:lifecycle:0001'
      })
      .expect(201);
    expect(created.body.targetId).toBe('short_lifecycle');
    expect(created.body.webPath).toBe('/profile/short_lifecycle');

    const exported = await account.exportData(user.body.user.id);
    expect(exported.formatVersion).toBe(19);
    expect(exported.shortLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          ownerId: user.body.user.id,
          targetId: 'short_lifecycle'
        })
      ])
    );

    await account.deleteAccount(user.body.user.id, { password: 'KnowMeTest123!' });
    expect(await prisma.shortLink.count({ where: { ownerId: user.body.user.id } })).toBe(0);
    expect(
      await prisma.shortLinkReceipt.count({ where: { ownerId: user.body.user.id } })
    ).toBe(0);
  });
});
