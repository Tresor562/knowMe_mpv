import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe saved messages authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 80;

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

  it('saves only messages visible to the caller and remains idempotent', async () => {
    const alice = await register('saved.alice@knowme.test', 'saved_alice', 'Alice Saved');
    const bob = await register('saved.bob@knowme.test', 'saved_bob', 'Bob Saved');
    const outsider = await register('saved.outsider@knowme.test', 'saved_outsider', 'Outsider Saved');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Saved room', memberIds: [bob.body.user.id] })
      .expect(201);

    const message = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'A message worth keeping' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/saved-messages')
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ messageId: message.body.id })
      .expect(404);

    const firstSave = await request(app.getHttpServer())
      .post('/saved-messages')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ messageId: message.body.id })
      .expect(201);
    expect(firstSave.body.message).toMatchObject({
      id: message.body.id,
      conversationId: conversation.body.id,
      content: 'A message worth keeping'
    });

    await request(app.getHttpServer())
      .post('/saved-messages')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ messageId: message.body.id })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/saved-messages')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ messageId: message.body.id });

    await request(app.getHttpServer())
      .delete(`/saved-messages/${message.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200)
      .expect({ removed: true });

    const empty = await request(app.getHttpServer())
      .get('/saved-messages')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(empty.body.items).toEqual([]);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/saved-messages').expect(401);
  });
});
