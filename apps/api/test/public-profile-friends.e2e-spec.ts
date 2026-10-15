import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe public-profile friendship actions (e2e)', () => {
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

  async function register(username: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${username}@knowme.test`,
        username,
        displayName: username,
        password: 'KnowMeTest123!'
      })
      .expect(201);
    return {
      id: response.body.user.id as string,
      auth: { Authorization: `Bearer ${response.body.accessToken as string}` }
    };
  }

  it('uses the same authoritative relationship through send, cancel, accept, remove and block', async () => {
    const alice = await register('profilefriend_alice');
    const bob = await register('profilefriend_bob');
    const urlBob = '/social/friendships/by-username/profilefriend_bob';
    const urlAlice = '/social/friendships/by-username/profilefriend_alice';

    await request(app.getHttpServer()).get(urlBob).expect(401);
    await request(app.getHttpServer())
      .get(urlAlice).set(alice.auth).expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ status: 'SELF', targetUserId: alice.id, friendshipId: null });
      });
    await request(app.getHttpServer())
      .get(urlBob).set(alice.auth).expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ status: 'NONE', targetUserId: bob.id, friendshipId: null });
      });

    const first = await request(app.getHttpServer())
      .post('/social/friend-requests').set(alice.auth)
      .send({ addresseeId: bob.id }).expect(201);
    await request(app.getHttpServer())
      .get(urlBob).set(alice.auth).expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('OUTGOING');
        expect(body.friendshipId).toBe(first.body.id);
      });
    await request(app.getHttpServer())
      .get(urlAlice).set(bob.auth).expect(200)
      .expect(({ body }) => expect(body.status).toBe('INCOMING'));

    // Only the requester can cancel; cancellation must not silently revoke an accepted friend.
    await request(app.getHttpServer())
      .delete(`/social/friend-requests/${first.body.id}`).set(bob.auth).expect(404);
    await request(app.getHttpServer())
      .delete(`/social/friend-requests/${first.body.id}`).set(alice.auth).expect(200);
    await request(app.getHttpServer())
      .get(urlBob).set(alice.auth).expect(200)
      .expect(({ body }) => expect(body.status).toBe('NONE'));

    const second = await request(app.getHttpServer())
      .post('/social/friend-requests').set(alice.auth)
      .send({ addresseeId: bob.id }).expect(201);
    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${second.body.id}/accept`).set(bob.auth).expect(200);
    await request(app.getHttpServer())
      .delete(`/social/friend-requests/${second.body.id}`).set(alice.auth).expect(404);
    await request(app.getHttpServer())
      .get(urlBob).set(alice.auth).expect(200)
      .expect(({ body }) => expect(body.status).toBe('FRIENDS'));

    await request(app.getHttpServer())
      .delete(`/social/friends/${second.body.id}`).set(alice.auth).expect(200);
    await request(app.getHttpServer())
      .get(urlBob).set(alice.auth).expect(200)
      .expect(({ body }) => expect(body.status).toBe('NONE'));

    await request(app.getHttpServer())
      .post(`/social/blocks/${bob.id}`).set(alice.auth).expect(201);
    await request(app.getHttpServer())
      .get(urlAlice).set(bob.auth).expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('BLOCKED');
        expect(body.friendshipId).toBeNull();
      });
    await request(app.getHttpServer())
      .post('/social/friend-requests').set(bob.auth)
      .send({ addresseeId: alice.id }).expect(409);
    await request(app.getHttpServer())
      .post('/social/friend-requests').set(alice.auth)
      .send({ addresseeId: bob.id }).expect(409);
  });
});
