import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const publicKey = (byte: number) => Buffer.alloc(32, byte).toString('base64');
const signature = (byte: number) => Buffer.alloc(64, byte).toString('base64');

function deviceBundle(seed: number) {
  return {
    protocol: 'SIGNAL_LIBSIGNAL_V1',
    registrationId: 1000 + seed,
    identityKey: publicKey(seed),
    signedPreKeyId: 2000 + seed,
    signedPreKey: publicKey(seed + 1),
    signedPreKeySignature: signature(seed + 2),
    oneTimePreKeys: [
      { keyId: 3000 + seed, publicKey: publicKey(seed + 3) }
    ]
  };
}

async function registerUser(
  app: INestApplication,
  suffix: string
): Promise<{ id: string; token: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .set('User-Agent', `KnowMe E2EE Test ${suffix}`)
    .send({
      email: `e2ee-${suffix}@knowme.test`,
      username: `e2ee_${suffix}`,
      displayName: `E2EE ${suffix}`,
      password: 'KnowMeTest123!'
    })
    .expect(201);

  return {
    id: response.body.user.id as string,
    token: response.body.accessToken as string
  };
}

describe('KnowMe E2EE public key directory (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps private fields out, prevents silent identity replacement, and consumes prekeys once', async () => {
    const alice = await registerUser(app, 'alice');
    const bob = await registerUser(app, 'bob');
    const mallory = await registerUser(app, 'mallory');

    const conversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id] })
      .expect(201);
    const conversationId = conversation.body.id as string;

    const bobBundle = deviceBundle(20);
    const bobDevice = await request(app.getHttpServer())
      .post('/e2ee/devices')
      .set('Authorization', `Bearer ${bob.token}`)
      .send(bobBundle)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/e2ee/devices/${bobDevice.body.id}/prekeys`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        oneTimePreKeys: [
          {
            keyId: bobBundle.oneTimePreKeys[0]!.keyId,
            publicKey: publicKey(99)
          }
        ]
      })
      .expect(409);

    const originalPreKey = await prisma.e2eeOneTimePreKey.findUniqueOrThrow({
      where: {
        deviceId_keyId: {
          deviceId: bobDevice.body.id,
          keyId: bobBundle.oneTimePreKeys[0]!.keyId
        }
      }
    });
    expect(originalPreKey.publicKey).toBe(
      bobBundle.oneTimePreKeys[0]!.publicKey
    );

    await request(app.getHttpServer())
      .post('/e2ee/devices')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        ...deviceBundle(10),
        privateKey: Buffer.alloc(32, 99).toString('base64')
      })
      .expect(400);

    const aliceBundle = deviceBundle(10);
    await request(app.getHttpServer())
      .post('/e2ee/devices')
      .set('Authorization', `Bearer ${alice.token}`)
      .send(aliceBundle)
      .expect(201);

    await request(app.getHttpServer())
      .post('/e2ee/devices')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        ...aliceBundle,
        identityKey: publicKey(77)
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/e2ee/conversations/${conversationId}/bundles/${bob.id}/claim`)
      .set('Authorization', `Bearer ${mallory.token}`)
      .expect(403);

    const identities = await request(app.getHttpServer())
      .get(
        `/e2ee/conversations/${conversationId}/identities/${bob.id}`
      )
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);

    expect(identities.body.devices).toHaveLength(1);
    expect(identities.body.devices[0]).toEqual(
      expect.objectContaining({
        deviceId: bobDevice.body.id,
        identityKey: bobBundle.identityKey,
        identityFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/)
      })
    );

    const unclaimedBeforeBundle = await prisma.e2eeOneTimePreKey.count({
      where: {
        deviceId: bobDevice.body.id,
        claimedAt: null
      }
    });
    expect(unclaimedBeforeBundle).toBe(1);

    const firstClaim = await request(app.getHttpServer())
      .post(`/e2ee/conversations/${conversationId}/bundles/${bob.id}/claim`)
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(201);

    expect(firstClaim.body.bundles).toHaveLength(1);
    expect(firstClaim.body.bundles[0]).toEqual(
      expect.objectContaining({
        identityKey: bobBundle.identityKey,
        signedPreKey: expect.objectContaining({
          keyId: bobBundle.signedPreKeyId,
          publicKey: bobBundle.signedPreKey,
          signature: bobBundle.signedPreKeySignature
        }),
        oneTimePreKey: {
          keyId: bobBundle.oneTimePreKeys[0]!.keyId,
          publicKey: bobBundle.oneTimePreKeys[0]!.publicKey
        }
      })
    );

    const secondClaim = await request(app.getHttpServer())
      .post(`/e2ee/conversations/${conversationId}/bundles/${bob.id}/claim`)
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(201);

    expect(secondClaim.body.bundles).toHaveLength(1);
    expect(secondClaim.body.bundles[0].oneTimePreKey).toBeNull();

    await request(app.getHttpServer())
      .delete(`/e2ee/devices/${bobDevice.body.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);

    const afterRevocation = await request(app.getHttpServer())
      .post(`/e2ee/conversations/${conversationId}/bundles/${bob.id}/claim`)
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(201);

    expect(afterRevocation.body.bundles).toEqual([]);
  });
});
