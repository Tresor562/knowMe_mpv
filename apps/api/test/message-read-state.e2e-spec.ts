import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe message read state (e2e)', () => {
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

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@reads.knowme.test`,
        username: `reads_${index}`,
        displayName: `Reads ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('tracks unread messages, read states, notifications and stable pagination', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ memberIds: [bob.body.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'Premier message non lu.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'Deuxième message non lu.' })
      .expect(201);

    const bobList = await request(app.getHttpServer())
      .get('/conversations')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(bobList.body).toHaveLength(1);
    expect(bobList.body[0].unreadCount).toBe(2);

    await request(app.getHttpServer())
      .get('/conversations/unread-count')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200, { unread: 2 });

    const history = await request(app.getHttpServer())
      .get(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(history.body.items).toHaveLength(2);
    expect(history.body.readStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: alice.body.user.id }),
        expect.objectContaining({ userId: bob.body.user.id })
      ])
    );

    await request(app.getHttpServer())
      .patch(`/conversations/${conversation.body.id}/read`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(403);

    const marked = await request(app.getHttpServer())
      .patch(`/conversations/${conversation.body.id}/read`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(marked.body).toMatchObject({
      conversationId: conversation.body.id,
      userId: bob.body.user.id,
      unread: 0
    });

    await request(app.getHttpServer())
      .get('/conversations/unread-count')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200, { unread: 0 });

    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'Réponse de Bob.' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/conversations/unread-count')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200, { unread: 1 });

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const messageNotifications = notifications.body.filter(
      (notification: { type: string }) => notification.type === 'MESSAGE'
    );
    expect(messageNotifications).toHaveLength(2);

    const bulkContents = Array.from({ length: 35 }, (_, index) => `Historique ${String(index + 1).padStart(2, '0')}`);
    await prisma.message.createMany({
      data: bulkContents.map((content) => ({
        conversationId: conversation.body.id as string,
        senderId: alice.body.user.id as string,
        content
      }))
    });

    const firstPage = await request(app.getHttpServer())
      .get(`/conversations/${conversation.body.id}/messages?limit=30`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(30);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get(`/conversations/${conversation.body.id}/messages?limit=30&cursor=${firstPage.body.nextCursor}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(8);
    expect(secondPage.body.nextCursor).toBeNull();

    const combined = [...firstPage.body.items, ...secondPage.body.items] as Array<{ id: string; content: string }>;
    expect(new Set(combined.map((item) => item.id)).size).toBe(38);
    expect(combined.filter((item) => item.content.startsWith('Historique '))).toHaveLength(35);
  });
});
