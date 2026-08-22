import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Guest identity baseline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.guestIdentity.deleteMany();
  });

  afterAll(async () => {
    await prisma.guestIdentity.deleteMany();
    await app.close();
  });

  it('publishes a privacy-minimized guest policy without claiming gameplay support', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/policy')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      storesRealIdentity: false,
      storesContacts: false,
      requiresAccount: false,
      supportsGameplay: false,
      conversionEnabled: false
    }));
  });

  it('creates, resumes and revokes an expiring opaque guest credential', async () => {
    const creation = await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        publicAlias: 'Guest Player',
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(201);

    const token = creation.body.token as string;
    expect(token).toMatch(/^kg_[A-Za-z0-9_-]{43}$/);
    expect(creation.body.guest).toEqual(expect.objectContaining({
      publicAlias: 'Guest Player',
      locale: 'fr-BJ',
      consentVersion: '2026-08-22',
      ageGateState: 'ADULT',
      status: 'ACTIVE'
    }));
    expect(creation.body.guest).not.toHaveProperty('tokenHash');

    const stored = await prisma.guestIdentity.findUniqueOrThrow({
      where: { id: creation.body.guest.id as string }
    });
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(token);

    const resumed = await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(resumed.body.id).toBe(creation.body.guest.id);
    expect(resumed.body).not.toHaveProperty('tokenHash');

    await request(app.getHttpServer())
      .delete('/guest/session')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ revoked: true });

    await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('fails closed for malformed guest credentials and invalid profile input', async () => {
    await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', 'Bearer arbitrary-token')
      .expect(401);

    await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        publicAlias: '<script>alert(1)</script>',
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'NOT_A_REAL_GATE'
      })
      .expect(400);
  });
});
