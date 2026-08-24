import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Account recovery retention operations status (e2e)', () => {
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
        email: `${index}@recovery-ops.knowme.test`,
        username: `recovery_ops_${index}`,
        displayName: `Recovery Ops ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('keeps retention readiness private, permission-gated and bounded', async () => {
    await request(app.getHttpServer())
      .get('/admin/operations/account-recovery-retention')
      .expect(401);

    const operator = await register('operator');
    const token = operator.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/admin/operations/account-recovery-retention')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await prisma.user.update({
      where: { id: operator.body.user.id },
      data: { role: 'ADMIN' }
    });

    const response = await request(app.getHttpServer())
      .get('/admin/operations/account-recovery-retention')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      configured: expect.any(Boolean),
      enabled: expect.any(Boolean),
      readiness: expect.stringMatching(/^(UNCONFIGURED|DISABLED|AWAITING_FIRST_RUN|HEALTHY|FAILING|STALE)$/),
      intervalMs: expect.any(Number),
      nextExpectedRunAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastDeleted: 0
    });
    expect(Object.keys(response.body).sort()).toEqual([
      'configured',
      'enabled',
      'intervalMs',
      'lastAttemptAt',
      'lastDeleted',
      'lastFailureAt',
      'lastSuccessAt',
      'nextExpectedRunAt',
      'readiness'
    ]);
  });
});
