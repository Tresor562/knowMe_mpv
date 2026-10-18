import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Private paginated publication report history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies anonymous access and never exposes another reporter’s history or cursor', async () => {
    const first = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'post-reports-alice@knowme.test',
      username: 'postreports_alice',
      displayName: 'Reports Alice',
      password: 'KnowMeTest123!'
    }).expect(201);
    const second = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'post-reports-bob@knowme.test',
      username: 'postreports_bob',
      displayName: 'Reports Bob',
      password: 'KnowMeTest123!'
    }).expect(201);

    const aliceId = first.body.user.id as string;
    const bobId = second.body.user.id as string;
    const aliceAuth = { Authorization: `Bearer ${first.body.accessToken}` };
    const bobAuth = { Authorization: `Bearer ${second.body.accessToken}` };

    // UI-only ownership checks are insufficient: direct API calls must reject self-reporting.
    const ownPost = await prisma.post.create({
      data: { authorId: aliceId, content: 'Post belonging to Alice' },
      select: { id: true }
    });
    await request(app.getHttpServer()).post('/reports')
      .set(aliceAuth).send({
        targetType: 'POST', targetId: ownPost.id,
        reason: 'Test direct forbidden self-report'
      }).expect(403);
    expect(await prisma.report.count({
      where: { reporterId: aliceId, targetType: 'POST', targetId: ownPost.id }
    })).toBe(0);

    await prisma.report.createMany({
      data: [
        ...Array.from({ length: 22 }, (_, index) => ({
          reporterId: aliceId,
          targetType: 'POST',
          targetId: `post-${index}`,
          reason: 'Signalement test ' + index,
          createdAt: new Date(Date.UTC(2026, 9, 18, 12, 0, 0) - index * 1000)
        })),
        {
          reporterId: aliceId, targetType: 'COMMENT',
          targetId: 'comment-private', reason: 'Comment report'
        },
        {
          reporterId: bobId, targetType: 'POST',
          targetId: 'bob-private', reason: 'Private report'
        }
      ]
    });

    await request(app.getHttpServer()).get('/reports/mine/posts').expect(401);

    const page1 = await request(app.getHttpServer())
      .get('/reports/mine/posts').set(aliceAuth).expect(200);
    expect(page1.body.reports).toHaveLength(20);
    expect(page1.body.reports.every((entry: {targetType: string}) => entry.targetType === 'POST'))
      .toBe(true);
    expect(page1.body.nextCursor).toEqual(expect.any(String));
    expect(JSON.stringify(page1.body)).not.toContain('bob-private');
    expect(JSON.stringify(page1.body)).not.toContain('comment-private');

    const page2 = await request(app.getHttpServer())
      .get('/reports/mine/posts')
      .query({cursor:page1.body.nextCursor})
      .set(aliceAuth).expect(200);
    expect(page2.body.reports).toHaveLength(2);
    expect(page2.body.nextCursor).toBeNull();
    const allIds = [...page1.body.reports,...page2.body.reports]
      .map((entry: {id:string}) => entry.id);
    expect(new Set(allIds).size).toBe(22);

    const bobPage = await request(app.getHttpServer())
      .get('/reports/mine/posts').set(bobAuth).expect(200);
    expect(bobPage.body.reports).toHaveLength(1);
    expect(bobPage.body.reports[0].targetId).toBe('bob-private');

    await request(app.getHttpServer())
      .get('/reports/mine/posts')
      .query({cursor:bobPage.body.reports[0].id})
      .set(aliceAuth)
      .expect(400);

    const legacy = await request(app.getHttpServer())
      .get('/reports/mine').set(aliceAuth).expect(200);
    expect(legacy.body.some((entry: {targetType:string}) => entry.targetType === 'COMMENT'))
      .toBe(true);

    await prisma.report.update({
      where: { id: page1.body.reports[0].id },
      data: { status: 'RESOLVED' }
    });
    const reviewed = await request(app.getHttpServer())
      .get('/reports/mine/posts')
      .query({ status: 'RESOLVED' })
      .set(aliceAuth).expect(200);
    expect(reviewed.body.reports).toHaveLength(1);
    expect(reviewed.body.reports[0].status).toBe('RESOLVED');
    expect(reviewed.body.nextCursor).toBeNull();

    const open = await request(app.getHttpServer())
      .get('/reports/mine/posts')
      .query({ status: 'OPEN' })
      .set(aliceAuth).expect(200);
    expect(open.body.reports).toHaveLength(20);
    expect(open.body.nextCursor).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/reports/mine/posts')
      .query({ status: 'OPEN', cursor: reviewed.body.reports[0].id })
      .set(aliceAuth).expect(400);
    await request(app.getHttpServer())
      .get('/reports/mine/posts')
      .query({ status: 'NOT_REAL' })
      .set(aliceAuth).expect(400);
  });
});
