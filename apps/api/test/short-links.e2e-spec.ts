import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KMD-061 authoritative short-link registry (e2e)', () => {
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
        description: 'KMD-061 E2E short-link creation',
        enabled: true,
        exposeToClient: false,
        riskLevel: 'HIGH',
        owner: 'KnowMe CI'
      },
      update: { enabled: true, exposeToClient: false }
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

  it('creates idempotently, previews without target leakage, resolves once and revokes fail-closed', async () => {
    const alice = await register(
      'short61-alice@knowme.test',
      'short61_alice',
      'Short 61 Alice'
    );
    const payload = {
      kind: 'profile',
      targetId: alice.body.user.id,
      idempotencyKey: 'short61:create:alice:0001'
    };

    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(alice))
      .send(payload)
      .expect(201);

    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        code: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
        shortPath: expect.stringMatching(/^\/s\/[A-Za-z0-9_-]{16}$/),
        kind: 'profile',
        targetId: 'short61_alice',
        universalPath: '/open/v1/profile/short61_alice',
        deepLink: 'knowme://v1/profile/short61_alice',
        expiresAt: null,
        revokedAt: null
      })
    );

    const replay = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(alice))
      .send(payload)
      .expect(201);
    expect(replay.body.id).toBe(created.body.id);
    expect(await prisma.shortLink.count({ where: { ownerId: alice.body.user.id } })).toBe(1);

    const preview = await request(app.getHttpServer())
      .get(`/short-links/preview/${created.body.code}`)
      .expect(200);
    expect(preview.body).toEqual({
      code: created.body.code,
      kind: 'profile',
      expiresAt: null,
      policy: {
        internalKnowMeDestinationOnly: true,
        arbitraryExternalUrlsAllowed: false,
        targetIdExposedBeforeContinuation: false,
        authorizationRevalidated: true,
        contractVersion: 'v1'
      }
    });
    expect(JSON.stringify(preview.body)).not.toContain(alice.body.user.id);
    expect(JSON.stringify(preview.body)).not.toContain('short61_alice');

    let stored = await prisma.shortLink.findUnique({ where: { id: created.body.id } });
    expect(stored?.resolveCount).toBe(0);
    expect(stored?.lastResolvedAt).toBeNull();

    const resolved = await request(app.getHttpServer())
      .get(`/short-links/resolve/${created.body.code}`)
      .expect(200);
    expect(resolved.body).toEqual({
      code: created.body.code,
      kind: 'profile',
      universalPath: '/open/v1/profile/short61_alice',
      deepLink: 'knowme://v1/profile/short61_alice',
      expiresAt: null
    });
    expect(resolved.body).not.toHaveProperty('ownerId');
    expect(resolved.body).not.toHaveProperty('targetId');
    expect(resolved.body).not.toHaveProperty('id');

    stored = await prisma.shortLink.findUnique({ where: { id: created.body.id } });
    expect(stored?.resolveCount).toBe(1);
    expect(stored?.lastResolvedAt).toBeInstanceOf(Date);

    const revoked = await request(app.getHttpServer())
      .post(`/short-links/${created.body.id}/revoke`)
      .set(auth(alice))
      .send({ idempotencyKey: 'short61:revoke:alice:0001' })
      .expect(201);
    expect(revoked.body.revokedAt).toEqual(expect.any(String));

    for (const endpoint of ['preview', 'resolve']) {
      const unavailable = await request(app.getHttpServer())
        .get(`/short-links/${endpoint}/${created.body.code}`)
        .expect(404);
      expect(unavailable.body.message).toBe('Lien indisponible.');
    }
  });

  it('uses the same public error for expired and unknown codes', async () => {
    const user = await register(
      'short61-expiry@knowme.test',
      'short61_expiry',
      'Short 61 Expiry'
    );
    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(user))
      .send({
        kind: 'profile',
        targetId: 'short61_expiry',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        idempotencyKey: 'short61:create:expiry:0001'
      })
      .expect(201);

    await prisma.shortLink.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });

    const expired = await request(app.getHttpServer())
      .get(`/short-links/preview/${created.body.code}`)
      .expect(404);
    const unknown = await request(app.getHttpServer())
      .get('/short-links/preview/Abcd_12345-xyzQQ')
      .expect(404);
    expect(expired.body.message).toBe('Lien indisponible.');
    expect(unknown.body.message).toBe('Lien indisponible.');
  });

  it('rejects external-looking identifiers and unsupported destinations before persistence', async () => {
    const user = await register(
      'short61-invalid@knowme.test',
      'short61_invalid',
      'Short 61 Invalid'
    );

    for (const targetId of ['https://evil.example', '../admin', 'with.dot']) {
      await request(app.getHttpServer())
        .post('/short-links')
        .set(auth(user))
        .send({
          kind: 'profile',
          targetId,
          idempotencyKey: `short61:invalid:${targetId.length}:0001`
        })
        .expect(400);
    }

    for (const kind of ['event', 'sticker-pack']) {
      await request(app.getHttpServer())
        .post('/short-links')
        .set(auth(user))
        .send({
          kind,
          targetId: 'future_target_001',
          idempotencyKey: `short61:closed:${kind.replace('-', '_')}:0001`
        })
        .expect(403);
    }

    expect(await prisma.shortLink.count({ where: { ownerId: user.body.user.id } })).toBe(0);
  });

  it('revalidates community membership on preview and resolution', async () => {
    const owner = await register(
      'short61-owner@knowme.test',
      'short61_owner',
      'Short 61 Owner'
    );
    const member = await register(
      'short61-member@knowme.test',
      'short61_member',
      'Short 61 Member'
    );

    const circle = await prisma.profileCircle.create({
      data: {
        type: 'TEAM',
        name: 'Short Link Circle',
        slug: 'short61_circle',
        ownerUserId: owner.body.user.id,
        status: 'ACTIVE',
        maxMembers: 8,
        visibility: 'FRIENDS',
        joinable: false,
        members: {
          create: {
            userId: member.body.user.id,
            role: 'MEMBER',
            status: 'ACTIVE',
            consentedAt: new Date(),
            joinedAt: new Date()
          }
        }
      }
    });

    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(member))
      .send({
        kind: 'community',
        targetId: circle.id,
        idempotencyKey: 'short61:create:circle:0001'
      })
      .expect(201);
    expect(created.body.targetId).toBe('short61_circle');

    await request(app.getHttpServer())
      .get(`/short-links/preview/${created.body.code}`)
      .expect(200);

    await prisma.profileCircleMember.update({
      where: { circleId_userId: { circleId: circle.id, userId: member.body.user.id } },
      data: { status: 'LEFT', leftAt: new Date() }
    });

    for (const endpoint of ['preview', 'resolve']) {
      const unavailable = await request(app.getHttpServer())
        .get(`/short-links/${endpoint}/${created.body.code}`)
        .expect(404);
      expect(unavailable.body.message).toBe('Lien indisponible.');
    }
  });

  it('exports owned links and deletes registry plus receipts with the account', async () => {
    const user = await register(
      'short61-lifecycle@knowme.test',
      'short61_lifecycle',
      'Short 61 Lifecycle'
    );
    const created = await request(app.getHttpServer())
      .post('/short-links')
      .set(auth(user))
      .send({
        kind: 'profile',
        targetId: user.body.user.id,
        idempotencyKey: 'short61:create:lifecycle:0001'
      })
      .expect(201);

    const exported = await account.exportData(user.body.user.id);
    expect(exported.formatVersion).toBe(19);
    expect(exported.shortLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          ownerId: user.body.user.id,
          targetKind: 'profile',
          targetId: 'short61_lifecycle'
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
