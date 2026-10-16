/**
 * One-time, account-scoped owner request. Run ONLY inside the existing KnowMe API
 * container using its already provisioned production database connection.
 *
 * The four addresses are represented as SHA-256 digests to avoid exposing them
 * in a public repository or GitHub Actions logs. Never creates users or grants
 * administrator permissions.
 */
'use strict';
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const OWNER_GMAIL_HASHES = new Set([
  '1f9fc26673a75a83e1346c1f66576230534353546fbe3c7940da204bfc9a5d1d',
  'b209fcb81b184da7d76d5fd8e864052cbf22d73ad5a4b6199c792bfe1fbce076',
  'b14e9515ced5acedf338d4e0b21353c2db44448ff26ee3f27f63cbb2eb17d4c6',
  '3109cc2f1ac2ea5096303fc2969e52fbeeeb24af7d208ade31441d286c8fb364'
]);
function isApprovedOwnerEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return email.endsWith('@gmail.com') &&
    OWNER_GMAIL_HASHES.has(createHash('sha256').update(email).digest('hex'));
}

const prisma = new PrismaClient();
async function run() {
  // Do not create unknown accounts from an address: each target must already
  // exist in KnowMe, and suspended users are not activated.
  const gmailUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@gmail.com', mode: 'insensitive' } },
    select: {
      id: true, email: true, role: true, isSuspended: true,
      staffAccount: { select: { status: true, shieldStyle: true } }
    }
  });
  const targets = gmailUsers.filter((u) => isApprovedOwnerEmail(u.email));
  const report = { expected: OWNER_GMAIL_HASHES.size, existing: targets.length, activated: 0, alreadyActive: 0, withheld: 0 };
  if (targets.length === 0) {
    console.log(JSON.stringify({ status: 'NO_REGISTERED_APPROVED_ACCOUNTS', ...report }));
    process.exitCode = 2;
    return;
  }

  // Only cosmetic certification; no staff role grants, role escalation, or
  // changes to existing security permissions. A previously suspended or
  // revoked official account is NEVER automatically reactivated.
  const actorId = targets.find((u) => !u.isSuspended)?.id;
  if (!actorId) {
    console.log(JSON.stringify({ status: 'ALL_TARGET_ACCOUNTS_SUSPENDED', ...report }));
    process.exitCode = 2;
    return;
  }
  await prisma.$transaction(async (tx) => {
    for (const user of targets) {
      if (user.isSuspended || (user.staffAccount && user.staffAccount.status !== 'ACTIVE')) {
        report.withheld += 1;
        continue;
      }
      if (user.staffAccount) {
        if (user.staffAccount.shieldStyle !== 'GOLD') {
          await tx.staffAccount.update({
            where: { userId: user.id },
            data: { shieldStyle: 'GOLD' }
          });
          report.activated += 1;
        } else {
          report.alreadyActive += 1;
        }
      } else {
        await tx.staffAccount.create({
          data: {
            userId: user.id,
            staffRole: 'OWNER',
            status: 'ACTIVE',
            badgeLabel: 'Équipe KnowMe',
            shieldStyle: 'GOLD',
            grantsAdminAccess: false,
            previousUserRole: user.role,
            reason: 'Compte officiel propriétaire : demande explicite, activation sans rôle administrateur.',
            activatedById: actorId,
            activatedAt: new Date()
          }
        });
        report.activated += 1;
      }
    }
  }, { timeout: 20000, maxWait: 10000 });

  const fullyDone = targets.length === OWNER_GMAIL_HASHES.size && report.withheld === 0;
  console.log(JSON.stringify({ status: fullyDone ? 'COMPLETED' : 'PARTIAL', ...report }));
  if (!fullyDone) process.exitCode = 2;
}
run().catch((error) => {
  // Keep addresses, stack traces and database connections out of CI logs.
  console.error('KnowMe official-account activation failed (' + (error?.code || 'runtime') + ').');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
