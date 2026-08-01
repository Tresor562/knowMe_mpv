import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type NotificationRecord = {
  id: string;
  type: string;
  readAt: string | null;
  data?: Record<string, unknown>;
};

function businessNotifications(items: NotificationRecord[]) {
  return items.filter((item) => !item.type.startsWith('SECURITY_'));
}

describe('KnowMe structured notifications (e2e)', () => {
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
        email: `${index}@notifications.knowme.test`,
        username: `notify_${index}`,
        displayName: `Notify ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('creates actionable metadata, isolates recipients and synchronizes read state', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const charlie = await register('charlie');

    const friendship = await request(app.getHttpServer())
      .post('/social/friend-requests')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ addresseeId: bob.body.user.id })
      .expect(201);

    const bobNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const friendRequestNotification = businessNotifications(
      bobNotifications.body as NotificationRecord[]
    ).find((item) => item.type === 'FRIEND_REQUEST');

    expect(friendRequestNotification).toMatchObject({
      type: 'FRIEND_REQUEST',
      data: {
        route: '/friends',
        entityType: 'FRIENDSHIP',
        entityId: friendship.body.id,
        actorId: alice.body.user.id
      }
    });

    await request(app.getHttpServer())
      .patch(`/social/friend-requests/${friendship.body.id}/accept`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    const post = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: 'Publication pour notifications structurées.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/posts/${post.body.id}/like`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(201);

    const comment = await request(app.getHttpServer())
      .post(`/posts/${post.body.id}/comments`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'Commentaire temps réel.' })
      .expect(201);

    const challenge = await request(app.getHttpServer())
      .post('/challenges')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({
        title: 'Défi notification',
        questions: ['Quelle est la réponse ?']
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(201);

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ memberIds: [bob.body.user.id] })
      .expect(201);

    const sentMessage = await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'Message avec route de navigation.' })
      .expect(201);

    const aliceNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    const aliceItems = aliceNotifications.body as NotificationRecord[];
    const aliceBusinessItems = businessNotifications(aliceItems);
    const aliceSecurityItems = aliceItems.filter((item) =>
      item.type.startsWith('SECURITY_')
    );

    expect(aliceBusinessItems).toHaveLength(5);
    expect(aliceSecurityItems).toEqual([]);
    expect(aliceBusinessItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'FRIEND_ACCEPTED',
          data: expect.objectContaining({ route: '/friends', actorId: bob.body.user.id })
        }),
        expect.objectContaining({
          type: 'POST_LIKED',
          data: expect.objectContaining({ route: `/feed/${post.body.id}`, entityId: post.body.id })
        }),
        expect.objectContaining({
          type: 'POST_COMMENTED',
          data: expect.objectContaining({
            route: `/feed/${post.body.id}`,
            commentId: comment.body.id
          })
        }),
        expect.objectContaining({
          type: 'CHALLENGE_JOINED',
          data: expect.objectContaining({
            route: `/challenges/${challenge.body.id}`,
            entityId: challenge.body.id
          })
        }),
        expect.objectContaining({
          type: 'MESSAGE',
          data: expect.objectContaining({
            route: `/messages/${conversation.body.id}`,
            messageId: sentMessage.body.id
          })
        })
      ])
    );

    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200, { count: 5 });

    const firstBusiness = aliceBusinessItems[0];
    expect(firstBusiness).toBeDefined();
    const read = await request(app.getHttpServer())
      .patch(`/notifications/${firstBusiness!.id}/read`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(read.body.readAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200, { count: 4 });

    const allRead = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(allRead.body).toMatchObject({ count: 4 });
    expect(allRead.body.readAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200, { count: 0 });

    const charlieNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${charlie.body.accessToken}`)
      .expect(200);

    expect(
      businessNotifications(charlieNotifications.body as NotificationRecord[])
    ).toEqual([]);
    expect(charlieNotifications.body).toEqual([]);
  });
});
