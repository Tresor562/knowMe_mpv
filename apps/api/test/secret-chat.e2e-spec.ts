import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const key = (byte: number) => Buffer.alloc(32, byte).toString('base64');
const signature = (byte: number) => Buffer.alloc(64, byte).toString('base64');

function bundle(seed: number) {
  return {
    protocol: 'SIGNAL_LIBSIGNAL_V1',
    registrationId: 1000 + seed,
    identityKey: key(seed),
    signedPreKeyId: 2000 + seed,
    signedPreKey: key(seed + 1),
    signedPreKeySignature: signature(seed + 2),
    oneTimePreKeys: [
      { keyId: 3000 + seed, publicKey: key(seed + 3) }
    ]
  };
}

async function register(app: INestApplication, suffix: string) {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .set('User-Agent', `KnowMe Secret Chat Test ${suffix}`)
    .send({
      email: `secret-${suffix}@knowme.test`,
      username: `secret_${suffix}`,
      displayName: `Secret ${suffix}`,
      password: 'KnowMeTest123!'
    })
    .expect(201);

  return {
    userId: response.body.user.id as string,
    token: response.body.accessToken as string
  };
}

describe('KnowMe Secret Chats (e2e)', () => {
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

  it('stores only opaque per-device ciphertext and blocks Cloud Chat plaintext paths', async () => {
    const alice = await register(app, 'alice');
    const bob = await register(app, 'bob');

    const aliceDevice = await request(app.getHttpServer())
      .post('/e2ee/devices')
      .set('Authorization', `Bearer ${alice.token}`)
      .send(bundle(10))
      .expect(201);

    const bobDevice = await request(app.getHttpServer())
      .post('/e2ee/devices')
      .set('Authorization', `Bearer ${bob.token}`)
      .send(bundle(20))
      .expect(201);

    const conversation = await request(app.getHttpServer())
      .post('/e2ee/secret-conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.userId] })
      .expect(201);

    expect(conversation.body.encryptionMode).toBe('SECRET');

    await request(app.getHttpServer())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ content: 'this plaintext must never be persisted' })
      .expect(409);

    expect(
      await prisma.message.count({
        where: { conversationId: conversation.body.id }
      })
    ).toBe(0);

    const ciphertext = Buffer.alloc(96, 42).toString('base64');
    const sent = await request(app.getHttpServer())
      .post(`/e2ee/secret-conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        protocol: 'SIGNAL_LIBSIGNAL_V1',
        clientMessageId: 'client-msg-0001',
        envelopes: [
          {
            recipientDeviceId: bobDevice.body.id,
            messageKind: 'PREKEY',
            ciphertext
          }
        ]
      })
      .expect(201);

    expect(sent.body.replayed).toBe(false);

    const stored = await prisma.secretMessage.findUniqueOrThrow({
      where: { id: sent.body.id },
      include: { envelopes: true }
    });
    expect('content' in stored).toBe(false);
    expect(stored.envelopes).toHaveLength(1);
    expect(stored.envelopes[0]!.ciphertext).toBe(ciphertext);
    expect(stored.envelopes[0]!.ciphertext).not.toContain(
      'this plaintext must never be persisted'
    );

    const inbox = await request(app.getHttpServer())
      .get('/e2ee/secret-messages/inbox')
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);

    expect(inbox.body.deviceId).toBe(bobDevice.body.id);
    expect(inbox.body.items).toHaveLength(1);
    expect(inbox.body.items[0].ciphertext).toBe(ciphertext);
    expect(inbox.body.items[0].senderDeviceId).toBe(aliceDevice.body.id);

    const replay = await request(app.getHttpServer())
      .post(`/e2ee/secret-conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        protocol: 'SIGNAL_LIBSIGNAL_V1',
        clientMessageId: 'client-msg-0001',
        envelopes: [
          {
            recipientDeviceId: bobDevice.body.id,
            messageKind: 'RATCHET',
            ciphertext: Buffer.alloc(96, 43).toString('base64')
          }
        ]
      })
      .expect(201);

    expect(replay.body.replayed).toBe(true);
    expect(
      await prisma.secretMessage.count({
        where: { conversationId: conversation.body.id }
      })
    ).toBe(1);

    await request(app.getHttpServer())
      .patch(
        `/e2ee/secret-messages/inbox/${inbox.body.items[0].envelopeId}/delivered`
      )
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(
        `/e2ee/secret-messages/inbox/${inbox.body.items[0].envelopeId}/read`
      )
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);
  });
});
