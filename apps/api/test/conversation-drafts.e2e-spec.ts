import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe synchronized conversation drafts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 120;

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
    const sourceIp = `198.51.100.${registrationIpOctet++}`;
    return request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', sourceIp)
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  it('synchronizes only member drafts with optimistic version conflicts', async () => {
    const alice = await register('draft.alice@knowme.test', 'draft_alice', 'Alice Draft');
    const bob = await register('draft.bob@knowme.test', 'draft_bob', 'Bob Draft');
    const outsider = await register('draft.outsider@knowme.test', 'draft_outsider', 'Outsider Draft');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Draft room', memberIds: [bob.body.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/conversation-drafts/${conversation.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ content: 'should not exist', expectedVersion: 0 })
      .expect(404);

    const created = await request(app.getHttpServer())
      .put(`/conversation-drafts/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'first private draft', expectedVersion: 0 })
      .expect(200);
    expect(created.body).toMatchObject({
      conversationId: conversation.body.id,
      content: 'first private draft',
      version: 1
    });

    const updated = await request(app.getHttpServer())
      .put(`/conversation-drafts/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'newer private draft', expectedVersion: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ content: 'newer private draft', version: 2 });

    await request(app.getHttpServer())
      .put(`/conversation-drafts/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'stale overwrite', expectedVersion: 1 })
      .expect(409);

    const list = await request(app.getHttpServer())
      .get('/conversation-drafts')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      conversationId: conversation.body.id,
      content: 'newer private draft',
      version: 2
    });

    await request(app.getHttpServer())
      .delete(`/conversation-drafts/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200)
      .expect({ removed: true });
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/conversation-drafts').expect(401);
  });
});
