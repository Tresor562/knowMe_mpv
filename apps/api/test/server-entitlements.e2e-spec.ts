import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe account identity and server entitlements (e2e)', () => {
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

  it('keeps account identity unique and refuses modded client claims', async () => {
    const member = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'member@entitlements.knowme.test',
        username: 'ent_member',
        displayName: 'Entitlement Member',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const adminRegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@entitlements.knowme.test',
        username: 'ent_admin',
        displayName: 'Entitlement Admin',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    expect(member.body.user.accountId).toBe(member.body.user.id);
    expect(adminRegistration.body.user.accountId).toBe(
      adminRegistration.body.user.id
    );
    expect(member.body.user.accountId).not.toBe(
      adminRegistration.body.user.accountId
    );

    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200);

    expect(profile.body).toMatchObject({
      id: member.body.user.id,
      accountId: member.body.user.id,
      username: 'ent_member'
    });

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .set('x-entitlements', 'premium.core')
      .set('x-premium', 'true')
      .set('x-subscription-tier', 'premium')
      .expect(403);

    await request(app.getHttpServer())
      .post('/admin/entitlements/grants')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .send({
        userId: member.body.user.id,
        key: 'premium.core',
        source: 'ADMIN',
        reason: 'Tentative d’auto-attribution.'
      })
      .expect(403);

    await prisma.user.update({
      where: { id: adminRegistration.body.user.id },
      data: { role: 'ADMIN' }
    });

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'ent_admin', password: 'KnowMeTest123!' })
      .expect(201);

    const grant = await request(app.getHttpServer())
      .post('/admin/entitlements/grants')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({
        userId: member.body.user.id,
        key: 'premium.core',
        source: 'ADMIN',
        externalReference: 'manual-test-grant',
        reason: 'Validation du contrôle serveur.'
      })
      .expect(201);

    const entitlements = await request(app.getHttpServer())
      .get('/entitlements/me')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200);

    expect(entitlements.body.accountId).toBe(member.body.user.id);
    expect(entitlements.body.entitlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'premium.core', source: 'ADMIN' })
      ])
    );

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          accountId: member.body.user.id,
          entitlement: 'premium.core',
          access: 'granted'
        });
      });

    await request(app.getHttpServer())
      .patch(`/admin/entitlements/grants/${grant.body.id}/revoke`)
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({ reason: 'Fin du test de révocation.' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .set('x-entitlements', 'premium.core')
      .expect(403);

    const startsAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await request(app.getHttpServer())
      .post('/admin/entitlements/grants')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .send({
        userId: member.body.user.id,
        key: 'premium.core',
        source: 'PROMOTION',
        externalReference: 'expired-promotion',
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        reason: 'Promotion déjà expirée.'
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/exclusive/premium-insights')
      .set('Authorization', 'Bearer forged.payload.signature')
      .expect(401);

    const audit = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);

    expect(audit.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'ENTITLEMENT_GRANT',
          entityId: grant.body.id
        }),
        expect.objectContaining({
          action: 'ENTITLEMENT_REVOKE',
          entityId: grant.body.id
        })
      ])
    );
  });
});
