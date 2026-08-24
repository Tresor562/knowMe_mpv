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

  it(
    'keeps liveness available beyond the default global request quota',
    async () => {
      // The release invariant is that health probes stay available after more
      // than the default quota has been consumed. Concurrency is deliberately
      // avoided here: a socket burst tests transport pressure rather than the
      // throttler exemption. 121 requests is the smallest deterministic proof
      // that we crossed the default quota of 120 while keeping the assertion
      // focused on the application policy itself.
      for (let attempt = 1; attempt <= 121; attempt += 1) {
        const response = await request(app.getHttpServer()).get('/health/live');
        expect({ attempt, status: response.status }).toEqual({ attempt, status: 200 });
        expect(response.body?.status).toBe('ok');
      }
    },
    90_000,
  );
});
