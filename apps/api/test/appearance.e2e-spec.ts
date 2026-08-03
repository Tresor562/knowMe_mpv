import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe static application themes (e2e)', () => {
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

    await prisma.userAppearancePreference.deleteMany();
    await prisma.entitlementGrant.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('synchronizes versioned themes and falls back after entitlement loss', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'appearance-owner@knowme.test',
        username: 'appearance_owner',
        displayName: 'Appearance Owner',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const token = registered.body.accessToken as string;
    const userId = registered.body.user.id as string;

    const initial = await request(app.getHttpServer())
      .get('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(initial.body).toEqual(
      expect.objectContaining({
        preference: expect.objectContaining({
          selectedThemeKey: 'system',
          effectiveThemeKey: 'system',
          version: 0
        }),
        rules: expect.objectContaining({
          staticOnly: true,
          animatedThemesAllowed: false,
          functionalAdvantagesAllowed: false
        })
      })
    );
    expect(initial.body.themes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'light', locked: false }),
        expect.objectContaining({ key: 'midnight', locked: true })
      ])
    );

    await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ themeKey: 'midnight', expectedVersion: 0 })
      .expect(403);

    const dark = await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        themeKey: 'dark',
        contrast: 'HIGH',
        reduceTransparency: true,
        expectedVersion: 0
      })
      .expect(200);
    expect(dark.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'dark',
        effectiveThemeKey: 'dark',
        contrast: 'HIGH',
        reduceTransparency: true,
        version: 1
      })
    );

    const stale = await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ themeKey: 'light', expectedVersion: 0 })
      .expect(409);
    expect(stale.body.message).toContain('autre appareil');

    const entitlement = await prisma.entitlementGrant.create({
      data: {
        userId,
        key: 'theme.midnight',
        source: 'TEST',
        externalReference: 'kmd-031-e2e',
        reason: 'Validation du verrouillage des thèmes statiques Premium.'
      }
    });

    const premium = await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ themeKey: 'midnight', expectedVersion: 1 })
      .expect(200);
    expect(premium.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'midnight',
        effectiveThemeKey: 'midnight',
        version: 2,
        fallbackReason: null
      })
    );
    expect(
      premium.body.themes.find((theme: { key: string }) => theme.key === 'midnight')
    ).toEqual(expect.objectContaining({ locked: false }));

    const exported = await account.exportData(userId);
    expect(exported.formatVersion).toBe(7);
    expect(exported.appearance.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'midnight',
        effectiveThemeKey: 'midnight',
        version: 2
      })
    );

    await prisma.entitlementGrant.update({
      where: { id: entitlement.id },
      data: { revokedAt: new Date() }
    });

    const fallback = await request(app.getHttpServer())
      .get('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fallback.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'midnight',
        effectiveThemeKey: 'system',
        fallbackReason: 'ENTITLEMENT_MISSING',
        version: 2
      })
    );

    expect(
      await prisma.auditLog.count({
        where: { actorId: userId, action: 'APPEARANCE_PREFERENCE_UPDATED' }
      })
    ).toBe(2);

    await account.deleteAccount(userId, { password: 'KnowMeTest123!' });
    expect(await prisma.userAppearancePreference.count({ where: { userId } })).toBe(0);
  });
});
