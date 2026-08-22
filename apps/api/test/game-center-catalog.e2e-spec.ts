import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

 describe('KnowMe Game Center V2 catalog (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a public catalog with product metadata and no economic authority', async () => {
    const response = await request(app.getHttpServer()).get('/games/center').expect(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'pulse-duel',
          categories: expect.arrayContaining(['instant', 'social']),
          modes: ['multiplayer'],
          guestEligible: false,
          authoritativeServer: true,
          replayAvailable: true,
          economicStakeAllowed: false
        })
      ])
    );
  });

  it('filters catalog search and categories without requiring authentication', async () => {
    const filtered = await request(app.getHttpServer())
      .get('/games/center')
      .query({ q: 'pulse', category: 'instant' })
      .expect(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].key).toBe('pulse-duel');

    const categories = await request(app.getHttpServer())
      .get('/games/categories')
      .expect(200);
    expect(categories.body).toContainEqual(
      expect.objectContaining({ key: 'instant', label: 'Instant', gameCount: expect.any(Number) })
    );
  });

  it('returns an empty list for unknown category filters instead of widening discovery', async () => {
    const response = await request(app.getHttpServer())
      .get('/games/center')
      .query({ category: 'not-a-category' })
      .expect(200);
    expect(response.body).toEqual([]);
  });
});
