import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KMD-060 secure short links (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

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

  it('creates idempotently, resolves, aggregates usage and revokes fail-closed', async () => {
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
        expect(response.body.webPath).toBe('/profile/short_alice');
        expect(JSON.stringify(response.body)).not.toContain('ownerId');
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

  it('prevents a non-member from creating a group link', async () => {
    const owner = await register(
      'short-owner@knowme.test',
      'short_owner',
      'Short Owner'
    );
    const member = await register(
      'short-member@knowme.test',
      'short_member',
      'Short Member'
    );
    const outsider = await register(
      'short-outsider@knowme.test',
      'short_outsider',
      'Short Outsider'
    );

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set(auth(owner))
      .send({ title: 'KMD-060 group', memberIds: [member.body.user.id] })
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
});
