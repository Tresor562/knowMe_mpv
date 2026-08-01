import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative identity verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@verification.knowme.test`,
        username: `verification_${index}`,
        displayName: `Verification ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function evidence(reference: string, digestCharacter: string) {
    return {
      type: 'PROVIDER_ASSERTION',
      provider: 'KYC_TEST',
      opaqueReference: reference,
      digest: digestCharacter.repeat(64)
    };
  }

  it('keeps verified, Premium and staff badges separate and server-authoritative', async () => {
    const applicant = await register('applicant');
    const attacker = await register('attacker');
    const reviewerOne = await register('reviewer_one');
    const reviewerTwo = await register('reviewer_two');

    const applicantId = applicant.body.user.id as string;
    const applicantToken = applicant.body.accessToken as string;
    const attackerToken = attacker.body.accessToken as string;
    const reviewerOneId = reviewerOne.body.user.id as string;
    const reviewerOneToken = reviewerOne.body.accessToken as string;
    const reviewerTwoId = reviewerTwo.body.user.id as string;
    const reviewerTwoToken = reviewerTwo.body.accessToken as string;

    await prisma.user.updateMany({
      where: { id: { in: [reviewerOneId, reviewerTwoId] } },
      data: { role: 'ADMIN' }
    });

    await prisma.entitlementGrant.create({
      data: {
        userId: applicantId,
        key: 'premium.core',
        source: 'TEST',
        externalReference: 'premium-separation-test',
        reason: 'Vérifier que Premium ne crée pas un badge d’identité.'
      }
    });

    const premiumOnly = await request(app.getHttpServer())
      .get('/users/me')
      .set(auth(applicantToken))
      .expect(200);
    expect(premiumOnly.body.premium).toEqual(
      expect.objectContaining({ isPremium: true, label: 'Premium' })
    );
    expect(premiumOnly.body.verification).toBeNull();
    expect(premiumOnly.body.staff).toBeNull();

    await request(app.getHttpServer())
      .get('/admin/verification/requests')
      .set(auth(attackerToken))
      .set('x-role', 'ADMIN')
      .set('x-permissions', 'verification.manage')
      .expect(403);

    const submitted = await request(app.getHttpServer())
      .post('/verification/requests')
      .set(auth(applicantToken))
      .send({
        displayNameClaim: 'Verification applicant',
        countryCode: 'BJ',
        isVerified: true,
        staff: { isTeamMember: true },
        premium: true,
        evidence: [evidence('kyc_ref_applicant_001', 'a')]
      })
      .expect(201);

    expect(submitted.body).toEqual(
      expect.objectContaining({
        userId: applicantId,
        submissionNumber: 1,
        status: 'SUBMITTED',
        decisionVersion: 0,
        evidenceCount: 1
      })
    );
    expect(submitted.body).not.toHaveProperty('isVerified');
    expect(submitted.body).not.toHaveProperty('staff');
    expect(submitted.body).not.toHaveProperty('premium');

    await request(app.getHttpServer())
      .post('/verification/requests')
      .set(auth(applicantToken))
      .send({
        displayNameClaim: 'Duplicate applicant',
        evidence: [evidence('kyc_ref_applicant_duplicate', 'b')]
      })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/start`)
      .set(auth(applicantToken))
      .set('x-role', 'ADMIN')
      .set('x-permissions', 'verification.manage')
      .send({ expectedDecisionVersion: 0 })
      .expect(403);

    const queue = await request(app.getHttpServer())
      .get('/admin/verification/requests?status=SUBMITTED')
      .set(auth(reviewerOneToken))
      .expect(200);
    expect(queue.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: submitted.body.id,
          applicant: expect.objectContaining({ id: applicantId }),
          evidence: [
            expect.objectContaining({
              provider: 'KYC_TEST',
              opaqueReference: 'kyc_ref_applicant_001'
            })
          ]
        })
      ])
    );

    const started = await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/start`)
      .set(auth(reviewerOneToken))
      .send({ expectedDecisionVersion: 0 })
      .expect(200);
    expect(started.body).toEqual(
      expect.objectContaining({
        status: 'UNDER_REVIEW',
        reviewerId: reviewerOneId,
        decisionVersion: 1
      })
    );

    await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/approve`)
      .set(auth(reviewerTwoToken))
      .send({
        expectedDecisionVersion: 1,
        reason: 'Tentative par un autre examinateur.',
        expiresInDays: 365
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/approve`)
      .set(auth(reviewerOneToken))
      .send({
        expectedDecisionVersion: 0,
        reason: 'Version obsolète à refuser.',
        expiresInDays: 365
      })
      .expect(409);

    const approved = await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/approve`)
      .set(auth(reviewerOneToken))
      .send({
        expectedDecisionVersion: 1,
        reason: 'Assertion KYC valide et cohérente.',
        expiresInDays: 365
      })
      .expect(200);
    expect(approved.body).toEqual(
      expect.objectContaining({
        status: 'APPROVED',
        decisionVersion: 2,
        decisionReason: 'Assertion KYC valide et cohérente.'
      })
    );
    expect(new Date(approved.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const verifiedProfile = await request(app.getHttpServer())
      .get('/users/me')
      .set(auth(applicantToken))
      .expect(200);
    expect(verifiedProfile.body.verification).toEqual(
      expect.objectContaining({
        isVerified: true,
        label: 'Identité vérifiée',
        verificationId: submitted.body.id
      })
    );
    expect(verifiedProfile.body.premium).toEqual(
      expect.objectContaining({ isPremium: true })
    );
    expect(verifiedProfile.body.staff).toBeNull();

    const discovery = await request(app.getHttpServer())
      .get('/social/search?q=applicant')
      .set(auth(attackerToken))
      .expect(200);
    const discoveredApplicant = discovery.body.find(
      (item: { id: string }) => item.id === applicantId
    );
    expect(discoveredApplicant.verification).toEqual(
      expect.objectContaining({ isVerified: true })
    );
    expect(discoveredApplicant.premium).toEqual(
      expect.objectContaining({ isPremium: true })
    );
    expect(discoveredApplicant.staff).toBeNull();

    await prisma.staffAccount.create({
      data: {
        userId: applicantId,
        staffRole: 'COMMUNITY_MANAGER',
        status: 'ACTIVE',
        badgeLabel: 'Équipe KnowMe',
        shieldStyle: 'GOLD',
        grantsAdminAccess: false,
        previousUserRole: 'USER',
        reason: 'Vérifier la séparation des badges.',
        activatedById: reviewerOneId
      }
    });

    const allBadges = await request(app.getHttpServer())
      .get('/users/me')
      .set(auth(applicantToken))
      .expect(200);
    expect(allBadges.body.verification).toEqual(
      expect.objectContaining({ isVerified: true })
    );
    expect(allBadges.body.premium).toEqual(
      expect.objectContaining({ isPremium: true })
    );
    expect(allBadges.body.staff).toEqual(
      expect.objectContaining({
        isTeamMember: true,
        label: 'Équipe KnowMe',
        role: 'COMMUNITY_MANAGER'
      })
    );

    const revoked = await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/revoke`)
      .set(auth(reviewerTwoToken))
      .send({
        expectedDecisionVersion: 2,
        reason: 'Révocation de conformité testée.'
      })
      .expect(200);
    expect(revoked.body).toEqual(
      expect.objectContaining({ status: 'REVOKED', decisionVersion: 3 })
    );

    await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${submitted.body.id}/revoke`)
      .set(auth(reviewerTwoToken))
      .send({
        expectedDecisionVersion: 2,
        reason: 'Rejeu idempotent.'
      })
      .expect(200);

    const afterRevocation = await request(app.getHttpServer())
      .get('/users/me')
      .set(auth(applicantToken))
      .expect(200);
    expect(afterRevocation.body.verification).toBeNull();
    expect(afterRevocation.body.premium).toEqual(
      expect.objectContaining({ isPremium: true })
    );
    expect(afterRevocation.body.staff).toEqual(
      expect.objectContaining({ isTeamMember: true })
    );

    const second = await request(app.getHttpServer())
      .post('/verification/requests')
      .set(auth(applicantToken))
      .send({
        displayNameClaim: 'Verification applicant',
        countryCode: 'BJ',
        evidence: [evidence('kyc_ref_applicant_002', 'c')]
      })
      .expect(201);
    expect(second.body.submissionNumber).toBe(2);

    const withdrawn = await request(app.getHttpServer())
      .post(`/verification/requests/${second.body.id}/withdraw`)
      .set(auth(applicantToken))
      .send({ reason: 'Nouvelle capture nécessaire.' })
      .expect(201);
    expect(withdrawn.body).toEqual(
      expect.objectContaining({ status: 'WITHDRAWN', decisionVersion: 1 })
    );

    const third = await request(app.getHttpServer())
      .post('/verification/requests')
      .set(auth(applicantToken))
      .send({
        displayNameClaim: 'Verification applicant',
        countryCode: 'BJ',
        evidence: [evidence('kyc_ref_applicant_003', 'd')]
      })
      .expect(201);

    const thirdStarted = await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${third.body.id}/start`)
      .set(auth(reviewerOneToken))
      .send({ expectedDecisionVersion: 0 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/admin/verification/requests/${third.body.id}/approve`)
      .set(auth(reviewerOneToken))
      .send({
        expectedDecisionVersion: thirdStarted.body.decisionVersion,
        reason: 'Approbation destinée au test d’expiration.',
        expiresInDays: 30
      })
      .expect(200);

    await prisma.identityVerificationRequest.update({
      where: { id: third.body.id },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    const beforeReconcile = await request(app.getHttpServer())
      .get('/users/me')
      .set(auth(applicantToken))
      .expect(200);
    expect(beforeReconcile.body.verification).toBeNull();

    const reconciled = await request(app.getHttpServer())
      .post('/admin/verification/reconcile-expired')
      .set(auth(reviewerTwoToken))
      .expect(201);
    expect(reconciled.body).toEqual(
      expect.objectContaining({ examined: 1, expired: 1 })
    );

    const history = await request(app.getHttpServer())
      .get('/verification/me')
      .set(auth(applicantToken))
      .expect(200);
    expect(history.body).toHaveLength(3);
    expect(history.body.map((item: { status: string }) => item.status)).toEqual(
      expect.arrayContaining(['REVOKED', 'WITHDRAWN', 'EXPIRED'])
    );

    const [requestsCount, decisionsCount, audits] = await Promise.all([
      prisma.identityVerificationRequest.count({ where: { userId: applicantId } }),
      prisma.identityVerificationDecision.count({
        where: { request: { userId: applicantId } }
      }),
      prisma.auditLog.findMany({
        where: {
          targetAccountId: applicantId,
          action: { startsWith: 'IDENTITY_VERIFICATION_' }
        }
      })
    ]);
    expect(requestsCount).toBe(3);
    expect(decisionsCount).toBe(10);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'IDENTITY_VERIFICATION_SUBMIT' }),
        expect.objectContaining({ action: 'IDENTITY_VERIFICATION_APPROVED' }),
        expect.objectContaining({ action: 'IDENTITY_VERIFICATION_REVOKED' }),
        expect.objectContaining({ action: 'IDENTITY_VERIFICATION_WITHDRAW' }),
        expect.objectContaining({ action: 'IDENTITY_VERIFICATION_EXPIRE' })
      ])
    );
  });
});
