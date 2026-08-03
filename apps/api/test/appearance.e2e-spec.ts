import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe application personalization engine (e2e)', () => {
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

  it('synchronizes 100 themes, accessibility, packs and Premium combinations', async () => {
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
    expect(initial.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'system',
        effectiveThemeKey: 'system',
        effectiveIconPackKey: 'soft-glass',
        animationsEnabled: true,
        animatedIconsEnabled: true,
        uiSoundsEnabled: false,
        weatherEffectsEnabled: false,
        version: 0
      })
    );
    expect(initial.body.rules).toEqual(
      expect.objectContaining({
        themeCount: 100,
        freeThemeCount: 40,
        premiumThemeCount: 60,
        premiumThemeEntitlementKey: 'premium.themes',
        premiumAppIconEntitlementKey: 'premium.app_icons',
        animatedThemesAllowed: true,
        animationsCanBeDisabled: true,
        functionalAdvantagesAllowed: false
      })
    );
    expect(initial.body.themes).toHaveLength(100);
    expect(initial.body.iconPacks).toHaveLength(25);
    expect(initial.body.appIcons).toHaveLength(20);
    expect(initial.body.seasonalThemes).toHaveLength(10);
    expect(initial.body.themes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ order: 2, key: 'light-minimal', locked: false }),
        expect.objectContaining({ order: 41, key: 'galaxy-ultra', locked: true }),
        expect.objectContaining({ order: 100, key: 'knowme-prestige', locked: true })
      ])
    );

    await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ themeKey: 'galaxy-ultra', expectedVersion: 0 })
      .expect(403);

    const freeTheme = await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        themeKey: 'dark-elegant',
        contrast: 'HIGH',
        reduceTransparency: true,
        animationsEnabled: false,
        animatedIconsEnabled: false,
        uiSoundsEnabled: false,
        effectIntensity: 'LOW',
        expectedVersion: 0
      })
      .expect(200);
    expect(freeTheme.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'dark-elegant',
        effectiveThemeKey: 'dark-elegant',
        contrast: 'HIGH',
        reduceTransparency: true,
        animationsEnabled: false,
        animatedIconsEnabled: false,
        effectIntensity: 'LOW',
        version: 1
      })
    );

    const stale = await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ themeKey: 'light-minimal', expectedVersion: 0 })
      .expect(409);
    expect(stale.body.message).toContain('autre appareil');

    const [themeEntitlement, appIconEntitlement] = await Promise.all([
      prisma.entitlementGrant.create({
        data: {
          userId,
          key: 'premium.themes',
          source: 'TEST',
          externalReference: 'kmd-031-theme-premium-e2e',
          reason: 'Validation du moteur de thèmes Premium.'
        }
      }),
      prisma.entitlementGrant.create({
        data: {
          userId,
          key: 'premium.app_icons',
          source: 'TEST',
          externalReference: 'kmd-031-app-icon-premium-e2e',
          reason: 'Validation des icônes d’application Premium.'
        }
      })
    ]);

    const premium = await request(app.getHttpServer())
      .patch('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        themeKey: 'galaxy-ultra',
        secondaryThemeKey: 'cyberpunk',
        themeBlendMode: 'BALANCED',
        iconPackKey: 'neon',
        appIconKey: 'galaxy',
        animationsEnabled: true,
        animatedIconsEnabled: true,
        uiSoundsEnabled: true,
        weatherEffectsEnabled: true,
        effectIntensity: 'HIGH',
        automaticRotationMode: 'TIME',
        expectedVersion: 1
      })
      .expect(200);
    expect(premium.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'galaxy-ultra',
        effectiveThemeKey: 'galaxy-ultra',
        secondaryThemeKey: 'cyberpunk',
        effectiveSecondaryThemeKey: 'cyberpunk',
        effectiveThemeBlendMode: 'BALANCED',
        effectiveIconPackKey: 'neon',
        effectiveAppIconKey: 'galaxy',
        uiSoundsEnabled: true,
        weatherEffectsEnabled: true,
        automaticRotationMode: 'TIME',
        version: 2,
        fallbackReason: null
      })
    );
    expect(
      premium.body.themes.find((theme: { key: string }) => theme.key === 'galaxy-ultra')
    ).toEqual(expect.objectContaining({ locked: false }));

    const exported = await account.exportData(userId);
    expect(exported.formatVersion).toBe(7);
    expect(exported.appearance).toBeDefined();
    expect(exported.appearance!.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'galaxy-ultra',
        effectiveThemeKey: 'galaxy-ultra',
        effectiveThemeBlendMode: 'BALANCED',
        effectiveIconPackKey: 'neon',
        effectiveAppIconKey: 'galaxy',
        version: 2
      })
    );

    await prisma.entitlementGrant.updateMany({
      where: { id: { in: [themeEntitlement.id, appIconEntitlement.id] } },
      data: { revokedAt: new Date() }
    });

    const fallback = await request(app.getHttpServer())
      .get('/appearance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fallback.body.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'galaxy-ultra',
        effectiveThemeKey: 'system',
        effectiveSecondaryThemeKey: null,
        effectiveThemeBlendMode: 'OFF',
        effectiveIconPackKey: 'soft-glass',
        effectiveAppIconKey: 'classique-knowme',
        weatherEffectsEnabled: false,
        automaticRotationMode: 'OFF',
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
