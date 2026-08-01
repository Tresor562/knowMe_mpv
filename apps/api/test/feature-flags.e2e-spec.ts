import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe feature flags (e2e)', () => {
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

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@flags.knowme.test`,
        username: `flags_${index}`,
        displayName: `Flags ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('supports master shutdown, targeting, overrides and audit', async () => {
    const adminRegistration = await register('admin');
    const member = await register('member');

    await prisma.user.update({
      where: { id: adminRegistration.body.user.id },
      data: { role: 'ADMIN' }
    });

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'flags_admin', password: 'KnowMeTest123!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/admin/feature-flags')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .send({ key: 'concept-k', enabled: true, exposeToClient: true })
      .expect(403);

    await request(app.getHttpServer())
      .post('/admin/feature-flags')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({
        key: 'concept-k',
        description: 'Moteur d’animations gamifiées.',
        enabled: true,
        exposeToClient: true,
        riskLevel: 'NORMAL',
        owner: 'product-experience'
      })
      .expect(201);

    const catchAllRule = await request(app.getHttpServer())
      .post('/admin/feature-flags/concept-k/rules')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({ enabled: false, priority: -100 })
      .expect(201);

    await request(app.getHttpServer())
      .get('/feature-flags?keys=concept-k')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200, { 'concept-k': false });

    await request(app.getHttpServer())
      .put(`/admin/feature-flags/concept-k/overrides/${member.body.user.id}`)
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({ enabled: true })
      .expect(200);

    await request(app.getHttpServer())
      .get('/feature-flags?keys=concept-k')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200, { 'concept-k': true });

    await request(app.getHttpServer())
      .patch('/admin/feature-flags/concept-k')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({ enabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/feature-flags?keys=concept-k')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200, { 'concept-k': false });

    await request(app.getHttpServer())
      .patch('/admin/feature-flags/concept-k')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({ enabled: true })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/feature-flags/concept-k/overrides/${member.body.user.id}`)
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200, { deleted: true });

    await request(app.getHttpServer())
      .delete(`/admin/feature-flags/concept-k/rules/${catchAllRule.body.id}`)
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200, { deleted: true });

    await request(app.getHttpServer())
      .post('/admin/feature-flags/concept-k/rules')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({
        enabled: false,
        platform: 'android',
        country: 'BJ',
        minVersion: '2.0.0',
        priority: 50
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/feature-flags?keys=concept-k')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .set('x-client-platform', 'android')
      .set('x-country-code', 'bj')
      .set('x-client-version', '2.1.0')
      .expect(200, { 'concept-k': false });

    await request(app.getHttpServer())
      .get('/feature-flags?keys=concept-k')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .set('x-client-platform', 'android')
      .set('x-country-code', 'BJ')
      .set('x-client-version', '1.9.9')
      .expect(200, { 'concept-k': true });

    const flags = await request(app.getHttpServer())
      .get('/admin/feature-flags')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);

    expect(flags.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'concept-k',
          enabled: true,
          exposeToClient: true
        })
      ])
    );

    const audit = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);

    expect(audit.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'FEATURE_FLAG_CREATE' }),
        expect.objectContaining({ action: 'FEATURE_FLAG_OVERRIDE_SET' }),
        expect.objectContaining({ action: 'FEATURE_FLAG_RULE_CREATE' })
      ])
    );
  });
});
