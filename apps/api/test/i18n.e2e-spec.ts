import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe internationalization foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let account: AccountService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    account = app.get(AccountService);

    await prisma.userLocalePreference.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('detects, persists and versions locale preferences without breaking account lifecycle', async () => {
    const catalog = await request(app.getHttpServer())
      .get('/i18n/catalog')
      .expect(200);
    expect(catalog.body).toEqual(
      expect.objectContaining({
        contractVersion: 1,
        fallbackLocale: 'fr',
        clientErrorLocalizationByCode: true,
        userGeneratedContentTranslated: false
      })
    );
    expect(catalog.body.supportedLocales).toEqual([
      { locale: 'fr', nativeName: 'Français', direction: 'ltr' },
      { locale: 'en', nativeName: 'English', direction: 'ltr' }
    ]);

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'i18n-owner@knowme.test',
        username: 'i18n_owner',
        displayName: 'I18n Owner',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const token = registered.body.accessToken as string;
    const userId = registered.body.user.id as string;
    const authorization = { Authorization: `Bearer ${token}` };

    const detected = await request(app.getHttpServer())
      .get('/i18n/preferences')
      .set(authorization)
      .set('Accept-Language', 'pt-BR;q=1, en-US;q=0.8, fr;q=0.4')
      .expect(200);
    expect(detected.body).toEqual(
      expect.objectContaining({
        userId,
        locale: 'en',
        direction: 'ltr',
        source: 'DETECTED',
        version: 0,
        persisted: false,
        updatedAt: null
      })
    );
    expect(await prisma.userLocalePreference.count({ where: { userId } })).toBe(0);

    const legacyExport = await account.exportData(userId);
    expect(legacyExport.formatVersion).toBe(6);
    expect(legacyExport.localization).toBeUndefined();

    const saved = await request(app.getHttpServer())
      .put('/i18n/preferences')
      .set(authorization)
      .send({ locale: 'en', expectedVersion: 0 })
      .expect(200);
    expect(saved.body).toEqual(
      expect.objectContaining({
        userId,
        locale: 'en',
        direction: 'ltr',
        source: 'USER',
        version: 1,
        persisted: true
      })
    );

    const stale = await request(app.getHttpServer())
      .put('/i18n/preferences')
      .set(authorization)
      .send({ locale: 'fr', expectedVersion: 0 })
      .expect(409);
    expect(stale.body).toEqual(
      expect.objectContaining({
        statusCode: 409,
        code: 'I18N_VERSION_CONFLICT',
        details: { currentVersion: 1, currentLocale: 'en' }
      })
    );

    await request(app.getHttpServer())
      .put('/i18n/preferences')
      .set(authorization)
      .send({ locale: 'es', expectedVersion: 1 })
      .expect(400);

    const persisted = await request(app.getHttpServer())
      .get('/i18n/preferences')
      .set(authorization)
      .set('Accept-Language', 'fr-BJ')
      .expect(200);
    expect(persisted.body).toEqual(
      expect.objectContaining({
        locale: 'en',
        source: 'USER',
        version: 1,
        persisted: true
      })
    );

    const exported = await account.exportData(userId);
    expect(exported.formatVersion).toBe(10);
    expect(exported.localization).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        fallbackLocale: 'fr',
        supportedLocales: ['fr', 'en'],
        preference: expect.objectContaining({
          userId,
          locale: 'en',
          source: 'USER',
          version: 1
        })
      })
    );
    expect(
      await prisma.auditLog.count({
        where: { actorId: userId, action: 'LOCALE_PREFERENCE_UPDATED' }
      })
    ).toBe(1);

    await account.deleteAccount(userId, { password: 'KnowMeTest123!' });
    expect(await prisma.userLocalePreference.count({ where: { userId } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});
