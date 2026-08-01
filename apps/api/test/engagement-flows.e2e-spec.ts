import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type NotificationRecord = {
  id: string;
  type: string;
  readAt: string | null;
};

function businessNotifications(items: NotificationRecord[]) {
  return items.filter((item) => !item.type.startsWith('SECURITY_'));
}

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

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const notificationItems = notifications.body as NotificationRecord[];
    const unreadItems = notificationItems.filter((item) => !item.readAt);
    const friendRequestNotification = businessNotifications(notificationItems).find(
      (item) => item.type === 'FRIEND_REQUEST'
    );

    expect(unreadBefore.body.count).toBe(unreadItems.length);
    expect(friendRequestNotification).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/notifications/${friendRequestNotification!.id}/read`)
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

    for (const content of [
      'Premier message',
      'Deuxième message',
      'Troisième message'
    ]) {
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

  it('engages with a post and notifies its author', async () => {
    const author = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'author.s3@knowme.test',
        username: 'author_s3',
        displayName: 'Author Sprint 3',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const reader = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reader.s3@knowme.test',
        username: 'reader_s3',
        displayName: 'Reader Sprint 3',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const post = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .send({ content: 'Mon premier souvenir partagé sur KnowMe.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/posts/${post.body.id}/like`)
      .set('Authorization', `Bearer ${reader.body.accessToken}`)
      .expect(201, { liked: true });

    const comment = await request(app.getHttpServer())
      .post(`/posts/${post.body.id}/comments`)
      .set('Authorization', `Bearer ${reader.body.accessToken}`)
      .send({ content: 'Très beau souvenir !' })
      .expect(201);

    expect(comment.body.content).toBe('Très beau souvenir !');

    const detail = await request(app.getHttpServer())
      .get(`/posts/${post.body.id}`)
      .expect(200);

    expect(detail.body._count).toMatchObject({ likes: 1, comments: 1 });
    expect(detail.body.comments[0].author.id).toBe(reader.body.user.id);

    const unread = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .expect(200);

    const authorNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .expect(200);

    const authorItems = authorNotifications.body as NotificationRecord[];
    const authorBusinessItems = businessNotifications(authorItems);

    expect(unread.body.count).toBe(
      authorItems.filter((item) => !item.readAt).length
    );
    expect(authorBusinessItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'POST_LIKED' }),
        expect.objectContaining({ type: 'POST_COMMENTED' })
      ])
    );
    expect(authorBusinessItems).toHaveLength(2);

    await request(app.getHttpServer())
      .delete(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${reader.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .expect(200, { deleted: true });

    await request(app.getHttpServer())
      .get(`/posts/${post.body.id}`)
      .expect(404);
  });
});
