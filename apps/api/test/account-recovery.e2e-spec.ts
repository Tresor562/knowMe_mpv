import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Account recovery (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deliveredToken = '';

  beforeAll(async () => {
    process.env.ACCOUNT_RECOVERY_SECRET = 'e2e-recovery-secret-'.padEnd(64, 'r');
    process.env.ACCOUNT_RECOVERY_EMAIL_ENDPOINT = 'https://mail.knowme.test/send';
    process.env.ACCOUNT_RECOVERY_EMAIL_API_KEY = 'e2e-provider-key-123456789';
    process.env.ACCOUNT_RECOVERY_EMAIL_FROM = 'KnowMe <security@knowme.test>';
    process.env.WEB_URL = 'https://knowme.test';

    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { html: string };
      const match = body.html.match(/token=([^"&<]+)/);
      deliveredToken = decodeURIComponent(match?.[1] ?? '');
      return new Response('', { status: 202 });
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('keeps unknown addresses private', async () => {
    deliveredToken = '';
    await request(app.getHttpServer())
      .post('/auth/password-recovery')
      .send({ email: 'unknown@knowme.test' })
      .expect(201)
      .expect({ accepted: true });

    expect(deliveredToken).toBe('');
  });

  it('rejects oversized recovery inputs before account lookup or password hashing', async () => {
    await request(app.getHttpServer())
      .post('/auth/password-recovery')
      .send({ email: `${'a'.repeat(245)}@knowme.test` })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/password-reset')
      .send({ token: 'x'.repeat(4097), password: 'NewKnowMePassword456!' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/password-reset')
      .send({ token: 'x'.repeat(64), password: 'p'.repeat(129) })
      .expect(400);
  });

  it('resets a known account, rejects non-canonical tokens, revokes the old session and makes the recovery link single-use', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'recover@knowme.test',
        username: 'recover_user',
        displayName: 'Recover User',
        password: 'OldKnowMePassword123!'
      })
      .expect(201);

    const oldRefreshToken = registration.body.refreshToken as string;
    deliveredToken = '';

    await request(app.getHttpServer())
      .post('/auth/password-recovery')
      .send({ email: 'RECOVER@KNOWME.TEST' })
      .expect(201)
      .expect({ accepted: true });

    expect(deliveredToken.length).toBeGreaterThan(32);

    await request(app.getHttpServer())
      .post('/auth/password-reset')
      .send({ token: `${deliveredToken}.unexpected`, password: 'NewKnowMePassword456!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/password-reset')
      .send({ token: deliveredToken, password: 'NewKnowMePassword456!' })
      .expect(201)
      .expect({ reset: true });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'recover_user', password: 'OldKnowMePassword123!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'recover_user', password: 'NewKnowMePassword456!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/password-reset')
      .send({ token: deliveredToken, password: 'ThirdKnowMePassword789!' })
      .expect(401);
  });
});
