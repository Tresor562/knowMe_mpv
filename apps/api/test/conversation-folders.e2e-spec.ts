import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative conversation folders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 215;

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

  it('keeps folders private and only assigns conversations the owner can access', async () => {
    const alice = await register('folders.alice@knowme.test', 'folders_alice', 'Alice Folders');
    const bob = await register('folders.bob@knowme.test', 'folders_bob', 'Bob Folders');
    const outsider = await register('folders.outsider@knowme.test', 'folders_outsider', 'Outsider Folders');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Close friends', memberIds: [bob.body.user.id] })
      .expect(201);

    const first = await request(app.getHttpServer())
      .post('/conversation-folders')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ name: 'Proches', position: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/conversation-folders')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ name: ' proches ' })
      .expect(409);

    const bobFolder = await request(app.getHttpServer())
      .post('/conversation-folders')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ name: 'Proches' })
      .expect(201);
    expect(bobFolder.body.id).not.toBe(first.body.id);

    await request(app.getHttpServer())
      .put(`/conversation-folders/${first.body.id}/conversations/${conversation.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .put(`/conversation-folders/${first.body.id}/conversations/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/conversation-folders')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ name: 'À revoir', position: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/conversation-folders/${second.body.id}/conversations/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/conversation-folders')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(list.body.items.map((item: { name: string }) => item.name)).toEqual([
      'À revoir',
      'Proches'
    ]);
    expect(
      list.body.items.find((item: { id: string }) => item.id === second.body.id).conversationIds
    ).toEqual([conversation.body.id]);
    expect(
      list.body.items.find((item: { id: string }) => item.id === first.body.id).conversationIds
    ).toEqual([]);

    const renamed = await request(app.getHttpServer())
      .patch(`/conversation-folders/${second.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ name: 'Important', position: 0 })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Important', position: 0 });

    await request(app.getHttpServer())
      .delete(`/conversation-folders/assignments/${conversation.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200)
      .expect({ removed: true });

    await request(app.getHttpServer())
      .delete(`/conversation-folders/${second.body.id}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200)
      .expect({ removed: true });
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/conversation-folders').expect(401);
  });
});
