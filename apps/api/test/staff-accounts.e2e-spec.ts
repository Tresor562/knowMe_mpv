import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe staff accounts (e2e)', () => {
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

  async function register(index: string, email?: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: email ?? `${index}@staff.knowme.test`,
        username: `staff_${index}`,
        displayName: `Staff ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  async function login(identifier: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier, password: 'KnowMeTest123!' })
      .expect(201);
  }

  it('manages official accounts from the database with immediate access revocation', async () => {
    const adminRegistration = await register('admin');
    const officialRegistration = await register('official', 'tresorhtn@gmail.com');
    const lookalikeRegistration = await register(
      'lookalike',
      'team.knowme@example.test'
    );

    await prisma.user.update({
      where: { id: adminRegistration.body.user.id },
      data: { role: 'ADMIN' }
    });

    const adminToken = adminRegistration.body.accessToken as string;
    const officialToken = officialRegistration.body.accessToken as string;

    const lookalikeProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${lookalikeRegistration.body.accessToken}`)
      .expect(200);

    expect(lookalikeProfile.body.staff).toBeNull();
    expect(lookalikeProfile.body.role).toBe('USER');

    await request(app.getHttpServer())
      .post('/admin/staff-accounts')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({
        userId: officialRegistration.body.user.id,
        staffRole: 'OWNER',
        reason: 'Tentative d’auto-attribution.'
      })
      .expect(403);

    const activation = await request(app.getHttpServer())
      .post('/admin/staff-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-request-id', 'staff-activation-20260801')
      .send({
        userId: officialRegistration.body.user.id,
        staffRole: 'OWNER',
        grantsAdminAccess: true,
        reason: 'Compte officiel du fondateur KnowMe.'
      })
      .expect(201);

    expect(activation.body).toEqual(
      expect.objectContaining({
        userId: officialRegistration.body.user.id,
        status: 'ACTIVE',
        staffRole: 'OWNER',
        badgeLabel: 'Équipe KnowMe',
        shieldStyle: 'GOLD'
      })
    );

    const activeProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${officialToken}`)
      .expect(200);

    expect(activeProfile.body).toEqual(
      expect.objectContaining({
        accountId: officialRegistration.body.user.id,
        role: 'ADMIN',
        staff: {
          isTeamMember: true,
          label: 'Équipe KnowMe',
          shield: 'GOLD',
          role: 'OWNER'
        }
      })
    );

    // A public viewer must see the same server-authoritative gold shield.
    const publicProfile = await request(app.getHttpServer())
      .get('/profile-experience/public/staff_official')
      .expect(200);
    expect(publicProfile.body.header.staff).toEqual(activeProfile.body.staff);
    expect(publicProfile.body.header).not.toHaveProperty('email');

    // Approved staff on a non-Gmail account must never receive the gold seal.
    await request(app.getHttpServer())
      .post('/admin/staff-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: lookalikeRegistration.body.user.id
        staffRole: 'DEVELOPER',
        grantsAdminAccess: false,
        reason: 'Vérification du sceau neutre sur les adresses non Gmail.'
      })
      .expect(201);
    const nongmailProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${lookalikeRegistration.body.accessToken}`)
      .expect(200);
    expect(nongmailProfile.body.staff).toEqual(
      expect.objectContaining({ isTeamMember: true, shield: 'STANDARD' })
    );
    const nongmailPublic = await request(app.getHttpServer())
      .get('/profile-experience/public/staff_lookalike')
      .expect(200);
    expect(nongmailPublic.body.header.staff.shield).toBe('STANDARD');


    await request(app.getHttpServer())
      .get('/admin/staff-accounts')
      .set('Authorization', `Bearer ${officialToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/admin/staff-accounts/${activation.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED', reason: 'Test de suspension immédiate.' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${officialToken}`)
      .expect(401);

    const suspendedLogin = await login('staff_official');
    expect(suspendedLogin.body.user).toEqual(
      expect.objectContaining({ role: 'USER', staff: null })
    );

    await request(app.getHttpServer())
      .get('/admin/staff-accounts')
      .set('Authorization', `Bearer ${suspendedLogin.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/staff-accounts/${activation.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE', reason: 'Fin de la suspension de test.' })
      .expect(200);

    const reactivatedProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${suspendedLogin.body.accessToken}`)
      .expect(200);

    expect(reactivatedProfile.body.role).toBe('ADMIN');
    expect(reactivatedProfile.body.staff.role).toBe('OWNER');

    await request(app.getHttpServer())
      .patch(`/admin/staff-accounts/${activation.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REVOKED', reason: 'Test de révocation définitive.' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${suspendedLogin.body.accessToken}`)
      .expect(401);

    const revokedLogin = await login('staff_official');
    expect(revokedLogin.body.user).toEqual(
      expect.objectContaining({ role: 'USER', staff: null })
    );

    const emailBadgeAccount = await register('email_badge', 'badge@staff.knowme.test');
    await request(app.getHttpServer())
      .post('/admin/staff-accounts/by-email')
      .set('Authorization', `Bearer ${emailBadgeAccount.body.accessToken}`)
      .send({
        email: 'badge@staff.knowme.test',
        staffRole: 'OWNER',
        reason: 'Auto-attribution interdite'
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/admin/staff-accounts/by-email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'missing@staff.knowme.test',
        staffRole: 'OWNER',
        reason: 'Compte introuvable'
      })
      .expect(404);

    const byEmail = await request(app.getHttpServer())
      .post('/admin/staff-accounts/by-email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'BADGE@STAFF.KNOWME.TEST',
        staffRole: 'OWNER',
        reason: 'Identité contrôlée manuellement par un administrateur.'
      })
      .expect(201);

    expect(byEmail.body).toEqual(expect.objectContaining({
      userId: emailBadgeAccount.body.user.id,
      status: 'ACTIVE',
      shieldStyle: 'GOLD',
      grantsAdminAccess: false
    }));
    const emailBadgeProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${emailBadgeAccount.body.accessToken}`)
      .expect(200);
    expect(emailBadgeProfile.body.role).toBe('USER');
    expect(emailBadgeProfile.body.staff).toEqual(expect.objectContaining({
      shield: 'STANDARD',
      role: 'OWNER'
    }));

    const adminStaff = await request(app.getHttpServer())
      .post('/admin/staff-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: adminRegistration.body.user.id,
        staffRole: 'ADMINISTRATOR',
        grantsAdminAccess: true,
        reason: 'Compte administrateur de test.'
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/admin/staff-accounts/${adminStaff.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REVOKED', reason: 'Auto-révocation interdite.' })
      .expect(400);

    const audits = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(audits.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'STAFF_ACCOUNT_ACTIVATE',
          targetAccountId: officialRegistration.body.user.id
        }),
        expect.objectContaining({
          action: 'STAFF_ACCOUNT_SUSPENDED',
          targetAccountId: officialRegistration.body.user.id
        }),
        expect.objectContaining({
          action: 'STAFF_ACCOUNT_ACTIVE',
          targetAccountId: officialRegistration.body.user.id
        }),
        expect.objectContaining({
          action: 'STAFF_ACCOUNT_REVOKED',
          targetAccountId: officialRegistration.body.user.id
        })
      ])
    );
  });
});
