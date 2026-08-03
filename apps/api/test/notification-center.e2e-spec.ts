import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { NotificationCenterDigestService } from '../src/notifications/notification-center-digest.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe intelligent notification center (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let digests: NotificationCenterDigestService;
  let accounts: AccountService;

  beforeAll(async () => {
    process.env.NOTIFICATION_CENTER_DIGEST_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    digests = app.get(NotificationCenterDigestService);
    accounts = app.get(AccountService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.NOTIFICATION_CENTER_DIGEST_ENABLED;
    await app.close();
  });

  async function register() {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'center@notifications.knowme.test',
        username: 'notification_center',
        displayName: 'Notification Center',
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('filters, paginates, archives and digests notifications authoritatively', async () => {
    const account = await register();
    const token = account.body.accessToken as string;
    const userId = account.body.user.id as string;
    const authorization = { Authorization: `Bearer ${token}` };

    const defaults = await request(app.getHttpServer())
      .get('/notifications/preferences')
      .set(authorization)
      .expect(200);
    expect(defaults.body).toMatchObject({
      masterEnabled: true,
      realtimeEnabled: true,
      digestMode: 'INSTANT',
      dailyDigestMinute: 480,
      timezone: 'UTC'
    });

    await request(app.getHttpServer())
      .put('/notifications/preferences')
      .set(authorization)
      .send({
        masterEnabled: false,
        realtimeEnabled: false,
        categorySettings: { SOCIAL: false, SECURITY: false, SYSTEM: false }
      })
      .expect(200);

    const hidden = await notifications.create({
      userId,
      type: 'POST_LIKE',
      title: 'Interaction masquée',
      body: 'Cette interaction reste auditée mais cachée.'
    });
    const critical = await notifications.create({
      userId,
      type: 'SECURITY_LOGIN_ALERT',
      title: 'Nouvelle connexion',
      body: 'Une nouvelle connexion a été détectée.'
    });
    expect(hidden.deliveryPolicy.visibleInCenter).toBe(false);
    expect(critical.deliveryPolicy).toMatchObject({
      visibleInCenter: true,
      realtime: true,
      critical: true
    });

    const visible = await request(app.getHttpServer())
      .get('/notifications')
      .set(authorization)
      .expect(200);
    expect(visible.body.map((item: { id: string }) => item.id)).toEqual([
      critical.id
    ]);

    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set(authorization)
      .expect(200, { count: 1 });

    await request(app.getHttpServer())
      .post(`/notifications/${critical.id}/state`)
      .set(authorization)
      .send({ action: 'ARCHIVE', idempotencyKey: 'critical:archive:1' })
      .expect(400);

    await request(app.getHttpServer())
      .put('/notifications/preferences')
      .set(authorization)
      .send({
        masterEnabled: true,
        realtimeEnabled: true,
        digestMode: 'INSTANT',
        categorySettings: { SOCIAL: true }
      })
      .expect(200);

    const social = await notifications.create({
      userId,
      type: 'POST_COMMENT',
      title: 'Nouveau commentaire',
      body: 'Une personne a commenté votre publication.'
    });
    const firstArchive = await request(app.getHttpServer())
      .post(`/notifications/${social.id}/state`)
      .set(authorization)
      .send({ action: 'ARCHIVE', idempotencyKey: 'social:archive:0001' })
      .expect(201);
    expect(firstArchive.body.replayed).toBe(false);

    const replayArchive = await request(app.getHttpServer())
      .post(`/notifications/${social.id}/state`)
      .set(authorization)
      .send({ action: 'ARCHIVE', idempotencyKey: 'social:archive:0001' })
      .expect(201);
    expect(replayArchive.body.replayed).toBe(true);

    const activeAfterArchive = await request(app.getHttpServer())
      .get('/notifications/center?view=ACTIVE')
      .set(authorization)
      .expect(200);
    expect(
      activeAfterArchive.body.items.some(
        (item: { id: string }) => item.id === social.id
      )
    ).toBe(false);

    const archived = await request(app.getHttpServer())
      .get('/notifications/center?view=ARCHIVED')
      .set(authorization)
      .expect(200);
    expect(archived.body.items[0].id).toBe(social.id);

    await request(app.getHttpServer())
      .post(`/notifications/${social.id}/state`)
      .set(authorization)
      .send({ action: 'RESTORE', idempotencyKey: 'social:restore:0001' })
      .expect(201);

    await request(app.getHttpServer())
      .put('/notifications/preferences')
      .set(authorization)
      .send({
        digestMode: 'HOURLY',
        timezone: 'Africa/Porto-Novo'
      })
      .expect(200);

    const firstDigestItem = await notifications.create({
      userId,
      type: 'MESSAGE',
      title: 'Message A',
      body: 'Premier message du résumé.'
    });
    const secondDigestItem = await notifications.create({
      userId,
      type: 'MESSAGE',
      title: 'Message B',
      body: 'Deuxième message du résumé.'
    });
    expect(firstDigestItem.deliveryPolicy.digestMode).toBe('HOURLY');
    expect(secondDigestItem.deliveryPolicy.realtime).toBe(false);

    await prisma.notificationCenterDigestQueueItem.updateMany({
      where: {
        notificationId: { in: [firstDigestItem.id, secondDigestItem.id] }
      },
      data: { dueAt: new Date(Date.now() - 1_000) }
    });
    const firstFlush = await digests.flushDue();
    expect(firstFlush).toMatchObject({
      batches: 1,
      notifications: 1,
      items: 2,
      failed: 0
    });
    const secondFlush = await digests.flushDue();
    expect(secondFlush.notifications).toBe(0);

    const digestNotifications = await prisma.notification.findMany({
      where: { userId, type: 'NOTIFICATION_DIGEST' }
    });
    expect(digestNotifications).toHaveLength(1);
    expect(digestNotifications[0].body).toContain('2 nouvelles activités');

    await prisma.notification.createMany({
      data: Array.from({ length: 45 }, (_, index) => ({
        userId,
        type: 'POST_LIKE',
        title: `Activité ${index + 1}`,
        body: `Activité paginée ${index + 1}`
      }))
    });
    await request(app.getHttpServer())
      .put('/notifications/preferences')
      .set(authorization)
      .send({ digestMode: 'INSTANT' })
      .expect(200);

    const firstPage = await request(app.getHttpServer())
      .get('/notifications/center?view=ACTIVE&limit=20')
      .set(authorization)
      .expect(200);
    expect(firstPage.body.items).toHaveLength(20);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get(
        `/notifications/center?view=ACTIVE&limit=20&cursor=${firstPage.body.nextCursor}`
      )
      .set(authorization)
      .expect(200);
    expect(secondPage.body.items.length).toBeGreaterThan(0);
    const combinedIds = [
      ...firstPage.body.items.map((item: { id: string }) => item.id),
      ...secondPage.body.items.map((item: { id: string }) => item.id)
    ];
    expect(new Set(combinedIds).size).toBe(combinedIds.length);

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set(authorization)
      .expect(200);
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set(authorization)
      .expect(200, { count: 0 });

    const exported = await accounts.exportData(userId);
    expect(exported.formatVersion).toBe(9);
    expect(exported.notificationCenter).toMatchObject({
      formatVersion: 1,
      preference: { userId },
      transportSecretsIncluded: false
    });
    expect(exported.notificationCenter!.actionReceipts.length).toBeGreaterThan(0);
    expect(exported.notificationCenter!.digestBatches).toHaveLength(1);

    await accounts.deleteAccount(userId, { password: 'KnowMeTest123!' });
    const lifecycleCounts = await Promise.all([
      prisma.notificationCenterPreference.count({ where: { userId } }),
      prisma.notificationCenterUserState.count({ where: { userId } }),
      prisma.notificationCenterActionReceipt.count({ where: { userId } }),
      prisma.notificationCenterDigestQueueItem.count({ where: { userId } }),
      prisma.notificationCenterDigestBatch.count({ where: { userId } })
    ]);
    expect(lifecycleCounts).toEqual([0, 0, 0, 0, 0]);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});
