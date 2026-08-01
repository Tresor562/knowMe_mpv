import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe core flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" CASCADE'
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and returns the authenticated profile', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'sprint2@knowme.test',
        username: 'sprint2_user',
        displayName: 'Sprint Two',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    expect(registration.body.accessToken).toEqual(expect.any(String));
    expect(registration.body.refreshToken).toEqual(expect.any(String));
    expect(registration.body.user.username).toBe('sprint2_user');

    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${registration.body.accessToken}`)
      .expect(200);

    expect(profile.body).toMatchObject({
      email: 'sprint2@knowme.test',
      username: 'sprint2_user',
      displayName: 'Sprint Two'
    });
  });

  it('creates and lists an authenticated challenge', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'sprint2_user',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const token = login.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/challenges')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Qui me connaît vraiment ?',
        description: 'Premier parcours intégré du Sprint 2.',
        questions: [
          'Quel est mon objectif principal ?',
          'Quelle activité me motive le plus ?'
        ]
      })
      .expect(201);

    expect(created.body.title).toBe('Qui me connaît vraiment ?');
    expect(created.body.questions).toHaveLength(2);
    expect(created.body.participants).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/challenges')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id })
      ])
    );
  });

  it('connects two users and exchanges a message', async () => {
    const alice = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'alice@knowme.test',
        username: 'alice_s2',
        displayName: 'Alice',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const bob = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'bob@knowme.test',
        username: 'bob_s2',
        displayName: 'Bob',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const friendRequest = await request(app.getHttpServer())
      .post('/social/friend-requests')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ addresseeId: bob.body.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${friendRequest.body.id}/accept`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const friends = await request(app.getHttpServer())
      .get('/social/friends')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(friends.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user: expect.objectContaining({ id: bob.body.user.id })
        })
      ])
    );

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({
        title: 'Alice et Bob',
        memberIds: [bob.body.user.id]
      })
      .expect(201);

    const message = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'Salut Bob, bienvenue sur KnowMe !' })
      .expect(201);

    expect(message.body).toMatchObject({
      content: 'Salut Bob, bienvenue sur KnowMe !',
      senderId: alice.body.user.id
    });

    const conversations = await request(app.getHttpServer())
      .get('/conversations')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(conversations.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: conversation.body.id })
      ])
    );
  });
});
