import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('KnowMe private game library (e2e)', () => {
  let app: INestApplication;
  let aliceToken: string;
  let bobToken: string;

  beforeAll(async () => {
    process.env.GAME_PLATFORM_MAINTENANCE_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const alice = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'kmd188-alice@knowme.test', username: 'kmd188_alice', displayName: 'KMD 188 Alice', password: 'KnowMeTest123!' })
      .expect(201);
    const bob = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'kmd188-bob@knowme.test', username: 'kmd188_bob', displayName: 'KMD 188 Bob', password: 'KnowMeTest123!' })
      .expect(201);
    aliceToken = alice.body.accessToken as string;
    bobToken = bob.body.accessToken as string;
  });

  afterAll(async () => {
    delete process.env.GAME_PLATFORM_MAINTENANCE_ENABLED;
    await app.close();
  });

  it('requires authentication and keeps each library account-scoped', async () => {
    await request(app.getHttpServer()).get('/games/library').expect(401);

    await request(app.getHttpServer())
      .post('/games/pulse-duel/favorite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/games/sessions')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        gameKey: 'pulse-duel',
        opponentUsernames: ['kmd188_bob'],
        idempotencyKey: 'kmd188:library:create'
      })
      .expect(201);
    const sessionId = created.body.id as string;

    const alice = await request(app.getHttpServer())
      .get('/games/library')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(alice.body.favorites).toContainEqual(expect.objectContaining({ key: 'pulse-duel' }));
    expect(alice.body.continuePlaying).toContainEqual(expect.objectContaining({ sessionId, status: 'WAITING', participantStatus: 'JOINED' }));
    expect(alice.body.invitations).toEqual([]);

    const bob = await request(app.getHttpServer())
      .get('/games/library')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    expect(bob.body.favorites).toEqual([]);
    expect(bob.body.invitations).toContainEqual(expect.objectContaining({ sessionId, status: 'WAITING', participantStatus: 'INVITED' }));

    for (const card of [...alice.body.continuePlaying, ...bob.body.invitations]) {
      expect(card).not.toHaveProperty('state');
      expect(card).not.toHaveProperty('seed');
      expect(card).not.toHaveProperty('result');
      expect(card).not.toHaveProperty('ownerId');
      expect(card).not.toHaveProperty('winnerUserId');
      expect(card).not.toHaveProperty('participants');
    }
  });
});
