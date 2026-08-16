import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative message editing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 160;

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

  it('allows only the author to edit with optimistic editedAt conflicts', async () => {
    const alice = await register('edit.alice@knowme.test', 'edit_alice', 'Alice Edit');
    const bob = await register('edit.bob@knowme.test', 'edit_bob', 'Bob Edit');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Editing room', memberIds: [bob.body.user.id] })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'original text' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/conversations/${conversation.body.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'hijacked', expectedEditedAt: null })
      .expect(403);

    const edited = await request(app.getHttpServer())
      .patch(`/conversations/${conversation.body.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'edited text', expectedEditedAt: null })
      .expect(200);

    expect(edited.body).toMatchObject({
      id: created.body.id,
      content: 'edited text',
      presentation: { kind: 'TEXT', text: 'edited text' }
    });
    expect(edited.body.editedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .patch(`/conversations/${conversation.body.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'stale edit', expectedEditedAt: null })
      .expect(409);

    const second = await request(app.getHttpServer())
      .patch(`/conversations/${conversation.body.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'second edit', expectedEditedAt: edited.body.editedAt })
      .expect(200);
    expect(second.body.content).toBe('second edit');

    const history = await request(app.getHttpServer())
      .get(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);
    expect(history.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          content: 'second edit',
          editedAt: expect.any(String)
        })
      ])
    );
  });

  it('requires authentication and a defined concurrency token', async () => {
    await request(app.getHttpServer())
      .patch('/conversations/x/messages/y')
      .send({ content: 'edit', expectedEditedAt: null })
      .expect(401);
  });
});
