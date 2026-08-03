import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Avatar studio manifests (e2e)', () => {
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

  it('renders only owned layers and respects public slot privacy', async () => {
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'avatar-owner@knowme.test',
        username: 'avatar_owner',
        displayName: 'Avatar Owner',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const viewer = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'avatar-viewer@knowme.test',
        username: 'avatar_viewer',
        displayName: 'Avatar Viewer',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const hair = await prisma.cosmeticItemDefinition.create({
      data: {
        key: 'e2e-midnight-hair',
        version: 1,
        name: 'Cheveux minuit E2E',
        description: 'Couche de test autoritaire.',
        slot: 'AVATAR_HAIR',
        rarity: 'RARE',
        assetUrl: 'https://assets.knowme.test/avatar/hair-midnight.png',
        previewUrl: 'https://assets.knowme.test/avatar/hair-midnight-preview.png',
        active: true,
        createdById: owner.body.user.id,
        reason: 'Test E2E du studio d’avatar'
      }
    });

    await Promise.all([
      prisma.cosmeticOwnership.create({
        data: {
          userId: owner.body.user.id,
          itemId: hair.id,
          source: 'ADMIN',
          grantedById: owner.body.user.id,
          reason: 'Possession E2E du studio d’avatar'
        }
      }),
      prisma.privacyPreference.upsert({
        where: { userId: owner.body.user.id },
        create: {
          userId: owner.body.user.id,
          profileVisibility: 'PUBLIC',
          cosmeticVisibility: 'PUBLIC',
          hiddenCosmeticSlots: []
        },
        update: {
          profileVisibility: 'PUBLIC',
          cosmeticVisibility: 'PUBLIC',
          hiddenCosmeticSlots: []
        }
      })
    ]);

    const equipped = await request(app.getHttpServer())
      .put('/avatar-studio/equipment/AVATAR_HAIR')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ itemId: hair.id })
      .expect(200);

    expect(equipped.body.studio).toMatchObject({
      profile: { username: 'avatar_owner' },
      manifest: {
        renderer: 'LAYERED_ASSET_V1',
        width: 512,
        height: 512,
        fallback: { initials: 'AO' }
      }
    });
    expect(
      equipped.body.studio.manifest.layers.find(
        (layer: { slot: string }) => layer.slot === 'AVATAR_HAIR'
      )
    ).toMatchObject({
      zIndex: 20,
      fallback: false,
      item: {
        id: hair.id,
        key: 'e2e-midnight-hair',
        version: 1
      }
    });

    const publicVisible = await request(app.getHttpServer())
      .get('/avatar-studio/public/avatar_owner')
      .set('Authorization', `Bearer ${viewer.body.accessToken}`)
      .expect(200);

    expect(publicVisible.body.visible).toBe(true);
    expect(
      publicVisible.body.manifest.layers.find(
        (layer: { slot: string }) => layer.slot === 'AVATAR_HAIR'
      )
    ).toMatchObject({
      fallback: false,
      item: { id: hair.id }
    });

    await prisma.privacyPreference.update({
      where: { userId: owner.body.user.id },
      data: {
        hiddenCosmeticSlots: ['AVATAR_HAIR'],
        version: { increment: 1 }
      }
    });

    const publicHidden = await request(app.getHttpServer())
      .get('/avatar-studio/public/avatar_owner')
      .set('Authorization', `Bearer ${viewer.body.accessToken}`)
      .expect(200);

    expect(publicHidden.body.visible).toBe(true);
    expect(
      publicHidden.body.manifest.layers.find(
        (layer: { slot: string }) => layer.slot === 'AVATAR_HAIR'
      )
    ).toMatchObject({
      fallback: true,
      item: null
    });
  });
});
