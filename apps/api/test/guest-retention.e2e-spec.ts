import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GuestRetentionService, GUEST_PURGE_GRACE_MS } from '../src/guest-play/guest-retention.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Guest retention purge (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let retention: GuestRetentionService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    retention = app.get(GuestRetentionService);
    await prisma.guestIdentity.deleteMany();
  });

  afterAll(async () => {
    await prisma.guestIdentity.deleteMany();
    await app.close();
  });

  it('deletes only guest identities older than the expiry grace boundary', async () => {
    const now = new Date('2026-08-22T20:00:00.000Z');
    const oldExpiry = new Date(now.getTime() - GUEST_PURGE_GRACE_MS - 1);
    const withinGrace = new Date(now.getTime() - GUEST_PURGE_GRACE_MS + 60_000);
    const futureExpiry = new Date(now.getTime() + 60_000);

    const base = {
      locale: 'fr-BJ',
      consentVersion: '2026-08-22',
      ageGateState: 'ADULT' as const
    };

    const old = await prisma.guestIdentity.create({
      data: { ...base, tokenHash: '1'.repeat(64), expiresAt: oldExpiry }
    });
    const recent = await prisma.guestIdentity.create({
      data: { ...base, tokenHash: '2'.repeat(64), expiresAt: withinGrace }
    });
    const active = await prisma.guestIdentity.create({
      data: { ...base, tokenHash: '3'.repeat(64), expiresAt: futureExpiry }
    });

    await expect(retention.purgeExpired(now)).resolves.toEqual(expect.objectContaining({ deleted: 1 }));

    expect(await prisma.guestIdentity.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.guestIdentity.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.guestIdentity.findUnique({ where: { id: active.id } })).not.toBeNull();

    await expect(retention.purgeExpired(now)).resolves.toEqual(expect.objectContaining({ deleted: 0 }));
  });
});
