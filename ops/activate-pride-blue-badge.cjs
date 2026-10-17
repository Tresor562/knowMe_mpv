/**
 * One-off owner-authorized KnowMe blue certification for the existing @pride
 * account. Execute ONLY inside the running production KnowMe API container.
 * This is a platform-issued certification, NOT documentary identity validation.
 * No user creation, staff role, premium subscription or admin access.
 */
'use strict';

const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const USERNAME = 'pride';
const CERTIFICATION_LEVEL = 'PLATFORM_CERTIFIED';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const REASON = 'Certification bleue KnowMe attribuee directement sur instruction explicite du proprietaire de la plateforme, sans controle documentaire d identite.';

async function main() {
  const matches = await prisma.user.findMany({
    where: { username: { equals: USERNAME, mode: 'insensitive' } },
    select: { id: true, username: true, isSuspended: true },
    take: 2
  });
  if (matches.length !== 1 || matches[0].username.toLowerCase() !== USERNAME) {
    throw new Error('TARGET_ACCOUNT_NOT_UNIQUELY_FOUND');
  }
  const target = matches[0];
  if (target.isSuspended) throw new Error('TARGET_SUSPENDED');

  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.identityVerificationRequest.findFirst({
      where: {
        userId: target.id,
        status: 'APPROVED',
        expiresAt: { gt: new Date() }
      },
      select: { id: true, status: true, expiresAt: true }
    });
    if (existing) return 'ALREADY_CERTIFIED';

    const latest = await tx.identityVerificationRequest.aggregate({
      where: { userId: target.id },
      _max: { submissionNumber: true }
    });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + YEAR_MS);
    const record = await tx.identityVerificationRequest.create({
      data: {
        userId: target.id,
        submissionNumber: (latest._max.submissionNumber ?? 0) + 1,
        status: 'APPROVED',
        level: CERTIFICATION_LEVEL,
        displayNameClaim: null,
        evidenceCount: 0,
        reviewStartedAt: now,
        decidedAt: now,
        expiresAt,
        decisionReason: REASON,
        decisionVersion: 1,
        decisions: {
          create: {
            action: 'PLATFORM_OWNER_CERTIFY',
            previousStatus: 'NONE',
            nextStatus: 'APPROVED',
            reason: REASON,
            expiresAt
          }
        }
      },
      select: { id: true }
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'PLATFORM_OWNER_BLUE_CERTIFICATION',
        entity: 'IdentityVerificationRequest',
        entityId: record.id,
        targetAccountId: target.id,
        metadata: {
          source: 'owner_explicit_request',
          username: USERNAME,
          badge: 'BLUE',
          certificationLevel: CERTIFICATION_LEVEL,
          evidenceCollected: false
        }
      }
    });
    return 'ACTIVATED';
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });

  const now = new Date();
  const persisted = await prisma.identityVerificationRequest.findFirst({
    where: { userId: target.id, status: 'APPROVED', expiresAt: { gt: now } },
    orderBy: { decidedAt: 'desc' },
    select: { status: true, level: true, expiresAt: true }
  });
  if (!persisted) throw new Error('BADGE_PERSISTENCE_NOT_CONFIRMED');
  console.log(JSON.stringify({
    result: outcome,
    target: '@pride',
    badge: 'BLUE',
    databaseConfirmed: true,
    certificationLevel: persisted.level,
    expiresAt: persisted.expiresAt.toISOString()
  }));
}

main().catch((err) => {
  // No account credentials, connection strings or stack traces in workflow logs.
  console.error('PRIDE_CERTIFICATION_FAILED: ' + (
    ['TARGET_ACCOUNT_NOT_UNIQUELY_FOUND', 'TARGET_SUSPENDED',
     'BADGE_PERSISTENCE_NOT_CONFIRMED'].includes(err?.message)
      ? err.message : (err?.code || 'RUNTIME_ERROR')
  ));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
