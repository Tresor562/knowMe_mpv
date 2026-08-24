import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Health probe throttle isolation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps liveness available beyond the default global request quota', async () => {
    const responses = await Promise.all(
      Array.from({ length: 130 }, () => request(app.getHttpServer()).get('/health/live')),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => response.body?.status === 'ok')).toBe(true);
  });
});
