import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('KnowMe Game Center favorites (e2e)', () => {
  let app: INestApplication;
  let aliceToken: string;
  let bobToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const alice = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'kmd187-alice@knowme.test',
        username: 'kmd187_alice',
        displayName: 'KMD 187 Alice',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const bob = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'kmd187-bob@knowme.test',
        username: 'kmd187_bob',
        displayName: 'KMD 187 Bob',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    aliceToken = alice.body.accessToken as string;
    bobToken = bob.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for private favorites', async () => {
    await request(app.getHttpServer()).get('/games/favorites').expect(401);
    await request(app.getHttpServer()).post('/games/pulse-duel/favorite').expect(401);
  });

  it('adds and lists a favorite idempotently for only the authenticated account', async () => {
    await request(app.getHttpServer())
      .post('/games/pulse-duel/favorite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post('/games/pulse-duel/favorite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(201);

    const aliceFavorites = await request(app.getHttpServer())
      .get('/games/favorites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(aliceFavorites.body).toHaveLength(1);
    expect(aliceFavorites.body[0]).toEqual(
      expect.objectContaining({
        key: 'pulse-duel',
        authoritativeServer: true,
        economicStakeAllowed: false,
        favoritedAt: expect.any(String)
      })
    );

    const bobFavorites = await request(app.getHttpServer())
      .get('/games/favorites')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    expect(bobFavorites.body).toEqual([]);
  });

  it('includes favorites in the authenticated account export without exposing another account', async () => {
    const aliceExport = await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(aliceExport.body.formatVersion).toBeGreaterThanOrEqual(20);
    expect(aliceExport.body.gamePlatform?.favorites).toEqual([
      expect.objectContaining({
        definitionKey: 'pulse-duel',
        createdAt: expect.any(String)
      })
    ]);

    const bobExport = await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    expect(bobExport.body.gamePlatform?.favorites ?? []).toEqual([]);
  });

  it('fails closed for unavailable games and removes favorites idempotently', async () => {
    await request(app.getHttpServer())
      .post('/games/not-a-real-game/favorite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete('/games/pulse-duel/favorite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete('/games/pulse-duel/favorite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const favorites = await request(app.getHttpServer())
      .get('/games/favorites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(favorites.body).toEqual([]);
  });
});
