import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe safety and moderation flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, reviews and resolves a report, then suspends the target account', async () => {
    const reporter = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reporter@knowme.test',
        username: 'reporter_s4',
        displayName: 'Reporter',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const target = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'target@knowme.test',
        username: 'target_s4',
        displayName: 'Target',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const adminRegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@knowme.test',
        username: 'admin_s4',
        displayName: 'Admin',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    await prisma.user.update({
      where: { id: adminRegistration.body.user.id },
      data: { role: 'ADMIN' }
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin_s4', password: 'KnowMeTest123!' })
      .expect(201);

    const report = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporter.body.accessToken}`)
      .send({
        targetType: 'USER',
        targetId: target.body.user.id,
        reason: 'Comportement abusif répété pendant les interactions.'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporter.body.accessToken}`)
      .send({
        targetType: 'USER',
        targetId: target.body.user.id,
        reason: 'Deuxième signalement identique.'
      })
      .expect(409);

    const queue = await request(app.getHttpServer())
      .get('/admin/reports?status=OPEN')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(queue.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: report.body.id, status: 'OPEN' })
      ])
    );

    await request(app.getHttpServer())
      .patch(`/admin/reports/${report.body.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.body.user.id}/suspension`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({ suspended: true })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'target_s4', password: 'KnowMeTest123!' })
      .expect(401);

    const auditLogs = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(auditLogs.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'REPORT_RESOLVE', entityId: report.body.id }),
        expect.objectContaining({ action: 'USER_SUSPEND', entityId: target.body.user.id })
      ])
    );
  });
});
