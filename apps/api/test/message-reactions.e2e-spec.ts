import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative message reactions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 190;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    const sourceIp = `203.0.113.${registrationIpOctet++}`;
    return request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', sourceIp)
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  it('aggregates one standard reaction per member and hides foreign conversations', async () => {
    const alice = await register('react.alice@knowme.test', 'react_alice', 'Alice React');
    const bob = await register('react.bob@knowme.test', 'react_bob', 'Bob React');
    const outsider = await register('react.outsider@knowme.test', 'react_outsider', 'Outsider React');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Reaction room', memberIds: [bob.body.user.id] })
      .expect(201);

    const message = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'React to this' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/message-reactions/${message.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ emoji: '❤️' })
      .expect(404);

    await request(app.getHttpServer())
      .put(`/message-reactions/${message.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ emoji: '❤️' })
      .expect(200);

    const aggregate = await request(app.getHttpServer())
      .put(`/message-reactions/${message.body.id}`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ emoji: '❤️' })
      .expect(200);
    expect(aggregate.body).toMatchObject({
      messageId: message.body.id,
      myReaction: '❤️',
      reactions: [{ emoji: '❤️', count: 2 }]
    });

    const replaced = await request(app.getHttpServer())
      .put(`/message-reactions/${message.body.id}`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ emoji: '🔥' })
      .expect(200);
    expect(replaced.body.myReaction).toBe('🔥');
    expect(replaced.body.reactions).toEqual(
      expect.arrayContaining([
        { emoji: '❤️', count: 1 },
        { emoji: '🔥', count: 1 }
      ])
    );

    await request(app.getHttpServer())
      .put(`/message-reactions/${message.body.id}`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ emoji: 'not-an-emoji' })
      .expect(400);

    const removed = await request(app.getHttpServer())
      .delete(`/message-reactions/${message.body.id}`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);
    expect(removed.body.removed).toBe(true);
    expect(removed.body.myReaction).toBeNull();
    expect(removed.body.reactions).toEqual([{ emoji: '❤️', count: 1 }]);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/message-reactions/unknown').expect(401);
  });
});
