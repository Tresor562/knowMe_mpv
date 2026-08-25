import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Media quarantine operations status (e2e)', () => {
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

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@media-ops.knowme.test`,
        username: `media_ops_${index}`,
        displayName: `Media Ops ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('keeps quarantine telemetry private, permission-gated and aggregate-only', async () => {
    await request(app.getHttpServer()).get('/admin/operations/media-quarantine').expect(401);

    const operator = await register('operator');
    const token = operator.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await prisma.user.update({
      where: { id: operator.body.user.id },
      data: { role: 'ADMIN' }
    });

    const response = await request(app.getHttpServer())
      .get('/admin/operations/media-quarantine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      quarantined: expect.any(Number),
      infected: expect.any(Number),
      unavailable: expect.any(Number),
      oldestQuarantinedAt: null
    });
    expect(Object.keys(response.body).sort()).toEqual([
      'infected',
      'oldestQuarantinedAt',
      'quarantined',
      'unavailable'
    ]);
  });
});
