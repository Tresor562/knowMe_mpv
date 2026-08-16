import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe personal conversation archives (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 230;

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

  it('archives only conversations visible to the caller and restores independently', async () => {
    const alice = await register('archive.alice@knowme.test', 'archive_alice', 'Alice Archive');
    const bob = await register('archive.bob@knowme.test', 'archive_bob', 'Bob Archive');
    const outsider = await register('archive.outsider@knowme.test', 'archive_outsider', 'Outsider Archive');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Archive room', memberIds: [bob.body.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/conversation-archives/${conversation.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(404);

    const archived = await request(app.getHttpServer())
      .put(`/conversation-archives/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(archived.body).toMatchObject({
      userId: alice.body.user.id,
      conversationId: conversation.body.id
    });

    const aliceList = await request(app.getHttpServer())
      .get('/conversation-archives')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(aliceList.body.items).toHaveLength(1);
    expect(aliceList.body.items[0].conversationId).toBe(conversation.body.id);

    const bobList = await request(app.getHttpServer())
      .get('/conversation-archives')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);
    expect(bobList.body.items).toEqual([]);

    await request(app.getHttpServer())
      .put(`/conversation-archives/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/conversation-archives/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200)
      .expect({ restored: true });

    const restored = await request(app.getHttpServer())
      .get('/conversation-archives')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(restored.body.items).toEqual([]);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/conversation-archives').expect(401);
  });
});
