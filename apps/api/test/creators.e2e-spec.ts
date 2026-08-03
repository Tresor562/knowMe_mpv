import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { CreatorsService } from '../src/creators/creators.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe creator and audience foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accounts: AccountService;
  let creators: CreatorsService;

  beforeAll(async () => {
    process.env.CREATOR_METRICS_RETENTION_ENABLED = 'false';
    process.env.CREATOR_METRICS_HASH_SECRET = 'kmd-051-test-metric-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    accounts = app.get(AccountService);
    creators = app.get(CreatorsService);
    await prisma.creatorAudienceReceipt.deleteMany();
    await prisma.creatorMetricDaily.deleteMany();
    await prisma.creatorPinnedPost.deleteMany();
    await prisma.creatorFollow.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.CREATOR_METRICS_RETENTION_ENABLED;
    delete process.env.CREATOR_METRICS_HASH_SECRET;
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  it('creates a voluntary creator profile with idempotent audience and minimized analytics', async () => {
    const owner = await register(
      'creator-owner@knowme.test',
      'creator_owner',
      'Creator Owner'
    );
    const follower = await register(
      'creator-follower@knowme.test',
      'creator_follower',
      'Creator Follower'
    );
    const ownerId = owner.body.user.id as string;
    const followerId = follower.body.user.id as string;
    const ownerAuth = { Authorization: `Bearer ${owner.body.accessToken}` };
    const followerAuth = { Authorization: `Bearer ${follower.body.accessToken}` };

    const legacyExport = await accounts.exportData(ownerId);
    expect(legacyExport.formatVersion).toBe(6);
    expect(legacyExport.creatorFoundation).toBeUndefined();

    const activated = await request(app.getHttpServer())
      .put('/creators/me')
      .set(ownerAuth)
      .send({
        slug: 'nexus-tech',
        title: 'Nexus Tech',
        bio: 'Technologie, programmation et cybersécurité.',
        category: 'TECH',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        expectedVersion: 0
      })
      .expect(200);
    expect(activated.body).toEqual(
      expect.objectContaining({
        userId: ownerId,
        slug: 'nexus-tech',
        followerCount: 0,
        version: 1,
        staffRoleGranted: false,
        verificationGranted: false,
        premiumGranted: false
      })
    );

    await request(app.getHttpServer())
      .put('/creators/me')
      .set(followerAuth)
      .send({
        slug: 'nexus-tech',
        title: 'Copie',
        category: 'OTHER',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        expectedVersion: 0
      })
      .expect(409);

    const publicPage = await request(app.getHttpServer())
      .get('/creators/nexus-tech')
      .expect(200);
    expect(publicPage.body).toEqual(
      expect.objectContaining({
        slug: 'nexus-tech',
        owner: expect.objectContaining({ username: 'creator_owner' }),
        pinnedPosts: [],
        recentPosts: []
      })
    );

    const firstFollow = await request(app.getHttpServer())
      .put('/creators/nexus-tech/follow')
      .set(followerAuth)
      .expect(200);
    expect(firstFollow.body).toEqual({ following: true, replayed: false });
    const replayFollow = await request(app.getHttpServer())
      .put('/creators/nexus-tech/follow')
      .set(followerAuth)
      .expect(200);
    expect(replayFollow.body).toEqual({ following: true, replayed: true });
    expect(await prisma.creatorFollow.count()).toBe(1);
    expect(
      await prisma.creatorProfile.findUnique({ where: { userId: ownerId } })
    ).toMatchObject({ followerCount: 1 });
    expect(
      await prisma.notification.count({
        where: { userId: ownerId, type: 'CREATOR_FOLLOWED' }
      })
    ).toBe(1);

    const firstView = await request(app.getHttpServer())
      .post('/creators/nexus-tech/view')
      .set(followerAuth)
      .expect(201);
    expect(firstView.body).toEqual({ counted: true });
    const replayView = await request(app.getHttpServer())
      .post('/creators/nexus-tech/view')
      .set(followerAuth)
      .expect(201);
    expect(replayView.body).toEqual({
      counted: false,
      reason: 'ALREADY_COUNTED_TODAY'
    });

    const post = await prisma.post.create({
      data: {
        authorId: ownerId,
        content: 'Premier contenu créateur KnowMe.'
      }
    });
    await request(app.getHttpServer())
      .put(`/creators/me/pins/${post.id}`)
      .set(ownerAuth)
      .send({ position: 0 })
      .expect(200, { pinned: true, postId: post.id, position: 0 });

    await request(app.getHttpServer())
      .post(`/creators/posts/${post.id}/view`)
      .set(followerAuth)
      .expect(201, { counted: true });
    await request(app.getHttpServer())
      .post(`/creators/posts/${post.id}/view`)
      .set(followerAuth)
      .expect(201, { counted: false, reason: 'ALREADY_COUNTED_TODAY' });

    const dashboard = await request(app.getHttpServer())
      .get('/creators/me/dashboard')
      .set(ownerAuth)
      .expect(200);
    expect(dashboard.body).toEqual(
      expect.objectContaining({
        windowDays: 30,
        totals: expect.objectContaining({
          followers: 1,
          posts: 1,
          profileViews: 1,
          postViews: 1,
          followsGained: 1
        }),
        privacy: {
          uniqueAuthenticatedViewsOnly: true,
          rawViewerIdsStored: false,
          receiptRetentionDays: 35
        }
      })
    );

    const exported = await accounts.exportData(ownerId);
    expect(exported.formatVersion).toBe(12);
    expect(exported.creatorFoundation).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        audienceReceiptHashesIncluded: false,
        monetizationIncluded: false,
        profile: expect.objectContaining({ slug: 'nexus-tech' }),
        followers: [expect.objectContaining({ followerId })]
      })
    );
    expect(JSON.stringify(exported.creatorFoundation)).not.toContain('subjectHash');

    const suspended = await creators.govern(
      ownerId,
      ownerId,
      true,
      'Contrôle de gouvernance KMD-051.'
    );
    expect(suspended.status).toBe('SUSPENDED');
    await request(app.getHttpServer()).get('/creators/nexus-tech').expect(404);
    const restored = await creators.govern(ownerId, ownerId, false);
    expect(restored.status).toBe('PAUSED');
    expect(
      await prisma.auditLog.count({
        where: {
          entity: 'CreatorProfile',
          entityId: ownerId,
          action: { in: ['CREATOR_PROFILE_SUSPENDED', 'CREATOR_PROFILE_RESTORED'] }
        }
      })
    ).toBe(2);

    await request(app.getHttpServer())
      .put('/creators/me')
      .set(ownerAuth)
      .send({
        slug: 'nexus-tech',
        title: 'Nexus Tech',
        bio: 'Technologie, programmation et cybersécurité.',
        category: 'TECH',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        expectedVersion: restored.version
      })
      .expect(200);

    await accounts.deleteAccount(followerId, { password: 'KnowMeTest123!' });
    expect(await prisma.creatorFollow.count()).toBe(0);
    expect(
      await prisma.creatorProfile.findUnique({ where: { userId: ownerId } })
    ).toMatchObject({ followerCount: 0 });

    await accounts.deleteAccount(ownerId, { password: 'KnowMeTest123!' });
    expect(await prisma.creatorProfile.count({ where: { userId: ownerId } })).toBe(0);
    expect(await prisma.creatorPinnedPost.count({ where: { creatorId: ownerId } })).toBe(0);
    expect(await prisma.creatorMetricDaily.count({ where: { creatorId: ownerId } })).toBe(0);
    expect(await prisma.creatorAudienceReceipt.count({ where: { creatorId: ownerId } })).toBe(0);
  });
});
