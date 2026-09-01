import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DELETION_FENCE_PURPOSE = '__ACCOUNT_DELETION_MEDIA_LOCK__';

describe('KMD-373 media account-deletion fence cleanup (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('removes the retained media lifecycle fence atomically when the owning user is deleted', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'kmd373-fence@knowme.test',
        username: 'kmd373_fence',
        displayName: 'KMD 373 Fence',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const userId = registration.body.user.id as string;

    await prisma.mediaUploadSession.create({
      data: {
        ownerId: userId,
        tokenHash: 'kmd373-fence-token-hash',
        purpose: DELETION_FENCE_PURPOSE,
        visibility: 'PRIVATE',
        maxBytes: 0,
        allowedMime: [],
        expiresAt: new Date('9999-12-31T23:59:59.999Z'),
        consumedAt: new Date()
      }
    });

    expect(
      await prisma.mediaUploadSession.count({ where: { ownerId: userId, purpose: DELETION_FENCE_PURPOSE } })
    ).toBe(1);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.mediaUploadSession.count({ where: { ownerId: userId } })).toBe(0);
  });
});
