import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe granular access control (e2e)', () => {
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
        email: `${index}@rbac.knowme.test`,
        username: `rbac_${index}`,
        displayName: `RBAC ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('grants least privilege and revokes it without trusting client claims', async () => {
    const admin = await register('admin');
    const moderator = await register('moderator');
    const target = await register('target');

    await prisma.user.update({
      where: { id: admin.body.user.id },
      data: { role: 'ADMIN' }
    });

    const adminToken = admin.body.accessToken as string;
    const moderatorToken = moderator.body.accessToken as string;

    const legacyAccess = await request(app.getHttpServer())
      .get('/access/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(legacyAccess.body.permissions).toEqual(
      expect.arrayContaining([
        'rbac.manage',
        'staff.manage',
        'feature_flags.manage'
      ])
    );

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .set('x-role', 'ADMIN')
      .set('x-permissions', 'rbac.manage,staff.manage')
      .expect(403);

    const grant = await request(app.getHttpServer())
      .post('/admin/access-control/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: moderator.body.user.id,
        roleKey: 'moderator',
        reason: 'Modération opérationnelle de test.'
      })
      .expect(201);

    const moderatorAccess = await request(app.getHttpServer())
      .get('/access/me')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);

    expect(moderatorAccess.body.permissions).toEqual(
      expect.arrayContaining([
        'admin.dashboard.read',
        'moderation.reports.read',
        'moderation.reports.resolve',
        'users.suspension.manage'
      ])
    );
    expect(moderatorAccess.body.permissions).not.toContain('rbac.manage');
    expect(moderatorAccess.body.permissions).not.toContain('staff.manage');

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/reports')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.body.user.id}/suspension`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ suspended: true })
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/feature-flags')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/admin/entitlements/grants')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/admin/staff-accounts')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/admin/access-control/catalog')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);

    await prisma.userRoleGrant.update({
      where: { id: grant.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);

    const secondGrant = await request(app.getHttpServer())
      .post('/admin/access-control/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: moderator.body.user.id,
        roleKey: 'moderator',
        reason: 'Nouvelle attribution après expiration.'
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/admin/access-control/grants/${secondGrant.body.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Fin de la mission de modération.' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);

    const selfGrant = await request(app.getHttpServer())
      .post('/admin/access-control/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: admin.body.user.id,
        roleKey: 'administrator',
        reason: 'Attribution administrative de test.'
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/admin/access-control/grants/${selfGrant.body.id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Auto-révocation à bloquer.' })
      .expect(400);

    const catalog = await request(app.getHttpServer())
      .get('/admin/access-control/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(catalog.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'owner' }),
        expect.objectContaining({ key: 'moderator' }),
        expect.objectContaining({ key: 'developer' })
      ])
    );

    const audits = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(audits.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'RBAC_ROLE_GRANT',
          targetAccountId: moderator.body.user.id
        }),
        expect.objectContaining({
          action: 'RBAC_ROLE_REVOKE',
          targetAccountId: moderator.body.user.id
        })
      ])
    );
  });
});
