import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe engagement flows (e2e)', () => {
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
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads paginated messages and manages notification state', async () => {
    const alice = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'alice.s3@knowme.test',
        username: 'alice_s3',
        displayName: 'Alice Sprint 3',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const bob = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'bob.s3@knowme.test',
        username: 'bob_s3',
        displayName: 'Bob Sprint 3',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const friendRequest = await request(app.getHttpServer())
      .post('/social/friend-requests')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ addresseeId: bob.body.user.id })
      .expect(201);

    const unreadBefore = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(unreadBefore.body.count).toBe(1);

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/notifications/${notifications.body[0].id}/read`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${friendRequest.body.id}/accept`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ memberIds: [bob.body.user.id] })
      .expect(201);

    for (const content of ['Premier message', 'Deuxième message', 'Troisième message']) {
      await request(app.getHttpServer())
        .post(`/conversations/${conversation.body.id}/messages`)
        .set('Authorization', `Bearer ${alice.body.accessToken}`)
        .send({ content })
        .expect(201);
    }

    const history = await request(app.getHttpServer())
      .get(`/conversations/${conversation.body.id}/messages?limit=2`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(history.body.items).toHaveLength(2);
    expect(history.body.nextCursor).toEqual(expect.any(String));
    expect(history.body.items[1].content).toBe('Troisième message');
  });
});
