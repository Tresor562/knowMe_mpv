import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value: string) {
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/g, '')) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 value.');
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret: string, stepOffset = 0) {
  const step = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

describe('KnowMe account and device security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.reauthenticationProof.deleteMany();
    await prisma.securityEvent.deleteMany();
    await prisma.trustedDevice.deleteMany();
    await prisma.securityChallenge.deleteMany();
    await prisma.securityRecoveryCode.deleteMany();
    await prisma.accountSecurity.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires server-verified factors and revokes compromised access', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .set('User-Agent', 'KnowMe Security Test')
      .send({
        email: 'security@knowme.test',
        username: 'security_member',
        displayName: 'Security Member',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const userId = registration.body.user.id as string;
    const originalToken = registration.body.accessToken as string;

    const setup = await request(app.getHttpServer())
      .post('/security/2fa/setup')
      .set('Authorization', `Bearer ${originalToken}`)
      .send({ password: 'KnowMeTest123!' })
      .expect(201);

    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.body.otpauthUri).toContain('otpauth://totp/');

    const storedBeforeConfirmation = await prisma.accountSecurity.findUniqueOrThrow({
      where: { userId }
    });
    expect(storedBeforeConfirmation.totpCiphertext).not.toBe(setup.body.secret);
    expect(storedBeforeConfirmation.totpCiphertext).not.toBeNull();
    expect(storedBeforeConfirmation.totpIv).not.toBeNull();
    expect(storedBeforeConfirmation.totpTag).not.toBeNull();

    const confirmationCode = totp(setup.body.secret);
    const confirmation = await request(app.getHttpServer())
      .post('/security/2fa/confirm')
      .set('Authorization', `Bearer ${originalToken}`)
      .send({ code: confirmationCode })
      .expect(201);

    expect(confirmation.body.enabled).toBe(true);
    expect(confirmation.body.recoveryCodes).toHaveLength(10);
    const recoveryCodes = confirmation.body.recoveryCodes as string[];

    const hashes = await prisma.securityRecoveryCode.findMany({ where: { userId } });
    expect(hashes).toHaveLength(10);
    expect(hashes.some((item) => recoveryCodes.includes(item.codeHash))).toBe(false);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${originalToken}`)
      .expect(201);

    const passwordOnly = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', 'Android KnowMe Test')
      .send({ identifier: 'security_member', password: 'KnowMeTest123!' })
      .expect(201);

    expect(passwordOnly.body.requiresTwoFactor).toBe(true);
    expect(passwordOnly.body.accessToken).toBeUndefined();
    const firstChallenge = passwordOnly.body.challengeToken as string;

    const storedChallenge = await prisma.securityChallenge.findFirstOrThrow({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    expect(storedChallenge.tokenHash).not.toBe(firstChallenge);

    await request(app.getHttpServer())
      .post('/auth/login/2fa')
      .set('User-Agent', 'Android KnowMe Test')
      .send({ challengeToken: firstChallenge, code: confirmationCode })
      .expect(401);

    const trustedLogin = await request(app.getHttpServer())
      .post('/auth/login/2fa')
      .set('User-Agent', 'Android KnowMe Test')
      .send({
        challengeToken: firstChallenge,
        code: recoveryCodes[0],
        trustDevice: true,
        deviceLabel: 'Téléphone test',
        platform: 'ANDROID'
      })
      .expect(201);

    expect(trustedLogin.body.accessToken).toBeTruthy();
    expect(trustedLogin.body.trustedDeviceToken).toBeTruthy();
    const trustedToken = trustedLogin.body.trustedDeviceToken as string;
    const trustedSessionToken = trustedLogin.body.accessToken as string;
    const trustedDeviceId = trustedLogin.body.trustedDevice.id as string;

    await request(app.getHttpServer())
      .post('/auth/login/2fa')
      .set('User-Agent', 'Android KnowMe Test')
      .send({ challengeToken: firstChallenge, code: recoveryCodes[1] })
      .expect(401);

    const bypassWithValidDevice = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', 'Android KnowMe Test')
      .send({
        identifier: 'security_member',
        password: 'KnowMeTest123!',
        deviceToken: trustedToken
      })
      .expect(201);

    expect(bypassWithValidDevice.body.requiresTwoFactor).toBeUndefined();
    expect(bypassWithValidDevice.body.assurance).toBe('TRUSTED_DEVICE');
    const otherSessionId = bypassWithValidDevice.body.sessionId as string;

    const forgedDevice = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', 'Forged Client')
      .send({
        identifier: 'security_member',
        password: 'KnowMeTest123!',
        deviceToken: 'forged-device-token-that-does-not-exist'
      })
      .expect(201);
    expect(forgedDevice.body.requiresTwoFactor).toBe(true);

    await request(app.getHttpServer())
      .delete(`/security/devices/${trustedDeviceId}`)
      .set('Authorization', `Bearer ${trustedSessionToken}`)
      .expect(200);

    const afterDeviceRevocation = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', 'Android KnowMe Test')
      .send({
        identifier: 'security_member',
        password: 'KnowMeTest123!',
        deviceToken: trustedToken
      })
      .expect(201);
    expect(afterDeviceRevocation.body.requiresTwoFactor).toBe(true);

    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login/2fa')
      .set('User-Agent', 'Android KnowMe Test')
      .send({
        challengeToken: afterDeviceRevocation.body.challengeToken,
        code: recoveryCodes[1]
      })
      .expect(201);

    const currentToken = secondLogin.body.accessToken as string;
    const currentSessionId = secondLogin.body.sessionId as string;

    await prisma.authSession.update({
      where: { id: currentSessionId },
      data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) }
    });

    await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${currentToken}`)
      .expect(401);

    const reauth = await request(app.getHttpServer())
      .post('/security/reauthenticate')
      .set('Authorization', `Bearer ${currentToken}`)
      .send({ password: 'KnowMeTest123!', code: recoveryCodes[2] })
      .expect(201);

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${currentToken}`)
      .set('x-reauth-token', reauth.body.proofToken)
      .expect(200);

    const serializedExport = JSON.stringify(exported.body);
    expect(serializedExport).not.toContain(setup.body.secret);
    expect(serializedExport).not.toContain('totpCiphertext');
    expect(serializedExport).not.toContain('codeHash');
    expect(serializedExport).not.toContain(trustedToken);

    await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${currentToken}`)
      .set('x-reauth-token', reauth.body.proofToken)
      .expect(401);

    await request(app.getHttpServer())
      .patch('/security/password')
      .set('Authorization', `Bearer ${currentToken}`)
      .send({
        password: 'KnowMeTest123!',
        newPassword: 'KnowMeChanged456!',
        code: recoveryCodes[3]
      })
      .expect(200);

    const otherSession = await prisma.authSession.findUniqueOrThrow({
      where: { id: otherSessionId }
    });
    expect(otherSession.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${bypassWithValidDevice.body.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'security_member', password: 'KnowMeTest123!' })
      .expect(401);

    const newPasswordLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', 'Fresh Security Test')
      .send({ identifier: 'security_member', password: 'KnowMeChanged456!' })
      .expect(201);
    expect(newPasswordLogin.body.requiresTwoFactor).toBe(true);

    const finalSession = await request(app.getHttpServer())
      .post('/auth/login/2fa')
      .set('User-Agent', 'Fresh Security Test')
      .send({
        challengeToken: newPasswordLogin.body.challengeToken,
        code: recoveryCodes[4]
      })
      .expect(201);

    const status = await request(app.getHttpServer())
      .get('/security')
      .set('Authorization', `Bearer ${finalSession.body.accessToken}`)
      .expect(200);
    expect(status.body.twoFactorEnabled).toBe(true);
    expect(status.body.recoveryCodesRemaining).toBe(5);
    expect(status.body.events.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining([
        'TWO_FACTOR_ENABLED',
        'TWO_FACTOR_LOGIN_FAILED',
        'TRUSTED_DEVICE_ADDED',
        'TRUSTED_DEVICE_REVOKED',
        'PASSWORD_CHANGED'
      ])
    );

    await request(app.getHttpServer())
      .delete('/account')
      .set('Authorization', `Bearer ${finalSession.body.accessToken}`)
      .send({ password: 'KnowMeChanged456!' })
      .expect(200);

    const [securityCount, challengeCount, deviceCount, recoveryCount, eventCount] = await Promise.all([
      prisma.accountSecurity.count({ where: { userId } }),
      prisma.securityChallenge.count({ where: { userId } }),
      prisma.trustedDevice.count({ where: { userId } }),
      prisma.securityRecoveryCode.count({ where: { userId } }),
      prisma.securityEvent.count({ where: { userId } })
    ]);
    expect({ securityCount, challengeCount, deviceCount, recoveryCount, eventCount }).toEqual({
      securityCount: 0,
      challengeCount: 0,
      deviceCount: 0,
      recoveryCount: 0,
      eventCount: 0
    });
  });
});
