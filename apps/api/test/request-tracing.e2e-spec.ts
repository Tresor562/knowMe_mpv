import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe request tracing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const previousTrust = process.env.TRUST_REQUEST_ID_HEADER;

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
    if (previousTrust === undefined) delete process.env.TRUST_REQUEST_ID_HEADER;
    else process.env.TRUST_REQUEST_ID_HEADER = previousTrust;
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@trace.knowme.test`,
        username: `trace_${index}`,
        displayName: `Trace ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('adds request IDs and returns stable error envelopes', async () => {
    delete process.env.TRUST_REQUEST_ID_HEADER;

    const health = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'forged-request-id')
      .expect(200);

    expect(health.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(health.headers['x-request-id']).not.toBe('forged-request-id');

    const missing = await request(app.getHttpServer())
      .get('/route-that-does-not-exist')
      .expect(404);

    expect(missing.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        code: 'NOT_FOUND',
        requestId: missing.headers['x-request-id'],
        path: '/route-that-does-not-exist'
      })
    );

    const invalid = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'invalid' })
      .expect(400);

    expect(invalid.body.code).toBe('BAD_REQUEST');
    expect(invalid.body.requestId).toBe(invalid.headers['x-request-id']);
    expect(Array.isArray(invalid.body.details)).toBe(true);
  });

  it('propagates trusted trace IDs into administrative audit records', async () => {
    process.env.TRUST_REQUEST_ID_HEADER = 'true';
    const adminRegistration = await register('admin');
    const member = await register('member');

    await prisma.user.update({
      where: { id: adminRegistration.body.user.id },
      data: { role: 'ADMIN' }
    });

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'trace_admin', password: 'KnowMeTest123!' })
      .expect(201);

    const requestId = 'support-trace-20260801-0001';
    const correlationId = 'support-correlation-20260801-0001';
    const suspension = await request(app.getHttpServer())
      .patch(`/admin/users/${member.body.user.id}/suspension`)
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .set('x-request-id', requestId)
      .set('x-correlation-id', correlationId)
      .send({ suspended: true })
      .expect(200);

    expect(suspension.headers['x-request-id']).toBe(requestId);
    expect(suspension.headers['x-correlation-id']).toBe(correlationId);

    const audit = await request(app.getHttpServer())
      .get(`/admin/audit-logs?requestId=${encodeURIComponent(requestId)}`)
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);

    expect(audit.body).toEqual([
      expect.objectContaining({
        action: 'USER_SUSPEND',
        requestId,
        correlationId,
        actorId: adminRegistration.body.user.id,
        targetAccountId: member.body.user.id
      })
    ]);
  });
});
