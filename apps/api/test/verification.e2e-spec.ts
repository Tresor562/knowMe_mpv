import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe identity verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let privateDirectory: string;

  beforeAll(async () => {
    privateDirectory = await mkdtemp(join(tmpdir(), 'knowme-verification-'));
    process.env.VERIFICATION_PRIVATE_DIR = privateDirectory;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.verificationDecision.deleteMany();
    await prisma.verifiedIdentity.deleteMany();
    await prisma.verificationDocument.deleteMany();
    await prisma.verificationRequest.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
    await rm(privateDirectory, { recursive: true, force: true });
    delete process.env.VERIFICATION_PRIVATE_DIR;
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@verification.knowme.test`,
        username: `verify_${index}`,
        displayName: `Verify ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('keeps documents private and badges server-authoritative', async () => {
    const applicant = await register('applicant');
    const observer = await register('observer');
    const admin = await register('admin');
    const applicantId = applicant.body.user.id as string;
    const applicantToken = applicant.body.accessToken as string;
    const observerToken = observer.body.accessToken as string;
    const adminToken = admin.body.accessToken as string;

    await prisma.user.update({
      where: { id: admin.body.user.id },
      data: { role: 'ADMIN' }
    });

    await prisma.entitlementGrant.create({
      data: {
        userId: applicantId,
        key: 'premium.core',
        source: 'SUBSCRIPTION',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        reason: 'Prove that Premium does not grant verification.'
      }
    });

    const created = await request(app.getHttpServer())
      .post('/verification/requests')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        subjectType: 'PERSON',
        countryCode: 'BJ',
        publicCategory: 'CREATOR',
        publicReason: 'Créateur public KnowMe.',
        termsVersion: '2026-08-identity-v1',
        termsAccepted: true
      })
      .expect(201);

    const requestId = created.body.id as string;

    await request(app.getHttpServer())
      .post('/verification/requests')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        subjectType: 'PERSON',
        countryCode: 'BJ',
        publicCategory: 'PERSON',
        termsVersion: '2026-08-identity-v1',
        termsAccepted: true
      })
      .expect(409);

    const beforeApproval = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(beforeApproval.body.verified).toBeNull();

    await request(app.getHttpServer())
      .post(`/verification/requests/${requestId}/documents`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .field('kind', 'IDENTITY_FRONT')
      .attach('file', Buffer.from('private-id-front'), {
        filename: 'identity-front.jpg',
        contentType: 'image/jpeg'
      })
      .expect(201);

    const selfie = await request(app.getHttpServer())
      .post(`/verification/requests/${requestId}/documents`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .field('kind', 'SELFIE')
      .attach('file', Buffer.from('private-selfie'), {
        filename: 'selfie.png',
        contentType: 'image/png'
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/admin/verifications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .set('x-role', 'ADMIN')
      .set('x-permissions', 'verification.manage')
      .expect(403);

    await request(app.getHttpServer())
      .post(`/verification/requests/${requestId}/submit`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/verifications/${requestId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/admin/verifications/${requestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.documents).toHaveLength(2);
    expect(detail.body.documents[0].storageKey).toBeUndefined();
    expect(JSON.stringify(detail.body)).not.toContain('identity-front.jpg');

    await request(app.getHttpServer())
      .get(`/admin/verifications/${requestId}/documents/${selfie.body.id}`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(403);

    const privateDownload = await request(app.getHttpServer())
      .get(`/admin/verifications/${requestId}/documents/${selfie.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(privateDownload.headers['cache-control']).toContain('no-store');
    expect(privateDownload.headers['content-type']).toContain('image/png');

    await request(app.getHttpServer())
      .patch(`/admin/verifications/${requestId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'APPROVE',
        reasonCode: 'IDENTITY_CONFIRMED',
        userMessage: 'Ton identité a été confirmée.',
        internalNote: 'Document and selfie manually matched.',
        badgeLabel: 'Créateur certifié'
      })
      .expect(200);

    const afterApproval = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(afterApproval.body.verified).toEqual(
      expect.objectContaining({
        verified: true,
        label: 'Créateur certifié',
        category: 'CREATOR'
      })
    );

    const search = await request(app.getHttpServer())
      .get('/social/search?q=Verify%20applicant')
      .set('Authorization', `Bearer ${observerToken}`)
      .expect(200);
    expect(search.body[0].verified).toEqual(
      expect.objectContaining({ label: 'Créateur certifié' })
    );

    const myState = await request(app.getHttpServer())
      .get('/verification/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(myState.body.badge.verified).toBe(true);
    expect(myState.body.canCreateNew).toBe(false);
    expect(myState.body.request.decisions[0].internalNote).toBeUndefined();
    expect(myState.body.request.decisions[0].reviewerId).toBeUndefined();

    await request(app.getHttpServer())
      .post('/verification/requests')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        subjectType: 'PERSON',
        countryCode: 'BJ',
        publicCategory: 'PERSON',
        termsVersion: '2026-08-identity-v1',
        termsAccepted: true
      })
      .expect(409);

    const observerState = await request(app.getHttpServer())
      .get('/verification/me')
      .set('Authorization', `Bearer ${observerToken}`)
      .expect(200);
    expect(observerState.body.request).toBeNull();
    expect(observerState.body.badge).toBeNull();
    expect(observerState.body.canCreateNew).toBe(true);

    const exportData = await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    const serializedExport = JSON.stringify(exportData.body);
    expect(serializedExport).not.toContain('storageKey');
    expect(serializedExport).not.toContain('internalNote');
    expect(serializedExport).not.toContain('identity-front.jpg');

    await request(app.getHttpServer())
      .patch(`/admin/verifications/${requestId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'REVOKE',
        reasonCode: 'IDENTITY_NO_LONGER_VALID',
        userMessage: 'Le badge a été retiré après un nouvel examen.'
      })
      .expect(200);

    const afterRevocation = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(afterRevocation.body.verified).toBeNull();

    const stateAfterRevocation = await request(app.getHttpServer())
      .get('/verification/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(stateAfterRevocation.body.canCreateNew).toBe(true);

    const entitlement = await request(app.getHttpServer())
      .get('/entitlements/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(
      entitlement.body.entitlements.map((item: { key: string }) => item.key)
    ).toContain('premium.core');

    const [identity, decisions, auditLogs] = await Promise.all([
      prisma.verifiedIdentity.findUnique({ where: { userId: applicantId } }),
      prisma.verificationDecision.findMany({ where: { requestId } }),
      prisma.auditLog.findMany({
        where: { targetAccountId: applicantId, action: { startsWith: 'VERIFICATION_' } }
      })
    ]);
    expect(identity?.status).toBe('REVOKED');
    expect(decisions.map((decision) => decision.action)).toEqual(
      expect.arrayContaining(['APPROVE', 'REVOKE'])
    );
    expect(auditLogs.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(auditLogs)).not.toContain('identity-front.jpg');
    expect(JSON.stringify(auditLogs)).not.toContain('private-id-front');

    await request(app.getHttpServer())
      .delete('/account')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ password: 'KnowMeTest123!' })
      .expect(200);

    const [remainingRequests, remainingDocuments, remainingIdentity] = await Promise.all([
      prisma.verificationRequest.count({ where: { userId: applicantId } }),
      prisma.verificationDocument.count({ where: { requestId } }),
      prisma.verifiedIdentity.findUnique({ where: { userId: applicantId } })
    ]);
    expect(remainingRequests).toBe(0);
    expect(remainingDocuments).toBe(0);
    expect(remainingIdentity).toBeNull();
  });
});
