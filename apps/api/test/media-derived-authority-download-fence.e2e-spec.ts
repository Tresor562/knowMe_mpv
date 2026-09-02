import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let sequence = 0;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = () => resolvePromise();
  });
  return { promise, resolve };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('KMD-378 derived media authority download fence (e2e)', () => {
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

  async function createPair(label: string) {
    sequence += 1;
    const owner = await prisma.user.create({
      data: {
        email: `kmd378-owner-${label}-${sequence}@knowme.test`,
        username: `kmd378_owner_${label}_${sequence}`,
        passwordHash: 'test-only-hash',
        displayName: `KMD 378 owner ${label}`
      }
    });
    const guest = await prisma.user.create({
      data: {
        email: `kmd378-guest-${label}-${sequence}@knowme.test`,
        username: `kmd378_guest_${label}_${sequence}`,
        passwordHash: 'test-only-hash',
        displayName: `KMD 378 guest ${label}`
      }
    });
    return { owner, guest };
  }

  async function createAsset(
    ownerId: string,
    label: string,
    visibility: 'FRIENDS' | 'CONVERSATION',
    conversationId: string | null = null
  ) {
    return prisma.mediaAsset.create({
      data: {
        ownerId,
        storageKey: `kmd378/${label}-${sequence}.png`,
        originalName: `${label}.png`,
        declaredMime: 'image/png',
        detectedMime: 'image/png',
        size: 12,
        sha256: `${sequence}`.padStart(64, '0'),
        purpose: 'POST_ATTACHMENT',
        visibility,
        conversationId,
        status: 'AVAILABLE',
        scannerVerdict: 'CLEAN'
      }
    });
  }

  async function createDownload(assetId: string, userId: string, label: string) {
    return prisma.mediaDownloadGrant.create({
      data: {
        assetId,
        userId,
        tokenHash: `kmd378-${label}-${sequence}-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
  }

  it('allows FRIENDS-derived token authority and purges it when friendship is lost', async () => {
    const { owner, guest } = await createPair('friends');
    const friendship = await prisma.friendship.create({
      data: { requesterId: owner.id, addresseeId: guest.id, status: 'ACCEPTED' }
    });
    const asset = await createAsset(owner.id, 'friends', 'FRIENDS');

    await createDownload(asset.id, guest.id, 'friends');
    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(1);

    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'BLOCKED' }
    });

    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(0);
    await expect(createDownload(asset.id, guest.id, 'friends-after-loss')).rejects.toThrow();
  });

  it('allows CONVERSATION-derived token authority and purges it when membership is removed', async () => {
    const { owner, guest } = await createPair('conversation');
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        members: { create: [{ userId: owner.id }, { userId: guest.id }] }
      }
    });
    const asset = await createAsset(owner.id, 'conversation', 'CONVERSATION', conversation.id);

    await createDownload(asset.id, guest.id, 'conversation');
    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(1);

    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId: conversation.id, userId: guest.id } }
    });

    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(0);
    await expect(createDownload(asset.id, guest.id, 'conversation-after-loss')).rejects.toThrow();
  });

  it('preserves a token on derived-authority loss when an explicit grant still authorizes the user', async () => {
    const { owner, guest } = await createPair('alternate');
    const friendship = await prisma.friendship.create({
      data: { requesterId: owner.id, addresseeId: guest.id, status: 'ACCEPTED' }
    });
    const asset = await createAsset(owner.id, 'alternate', 'FRIENDS');
    await prisma.mediaAccessGrant.create({
      data: { assetId: asset.id, granteeId: guest.id, grantedBy: owner.id }
    });
    await createDownload(asset.id, guest.id, 'alternate');

    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'BLOCKED' } });

    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(1);
  });

  it('serializes membership-removal-first so a waiting token insert fails after commit', async () => {
    const { owner, guest } = await createPair('remove-first');
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        members: { create: [{ userId: owner.id }, { userId: guest.id }] }
      }
    });
    const asset = await createAsset(owner.id, 'remove-first', 'CONVERSATION', conversation.id);
    const removalReady = deferred();
    const releaseRemoval = deferred();

    const removal = prisma.$transaction(async (tx) => {
      await tx.conversationMember.delete({
        where: { conversationId_userId: { conversationId: conversation.id, userId: guest.id } }
      });
      removalReady.resolve();
      await releaseRemoval.promise;
    });

    await removalReady.promise;

    let issuanceSettled = false;
    const issuance = createDownload(asset.id, guest.id, 'remove-first-race').then(
      (value) => {
        issuanceSettled = true;
        return value;
      },
      (error) => {
        issuanceSettled = true;
        throw error;
      }
    );

    await sleep(100);
    expect(issuanceSettled).toBe(false);

    releaseRemoval.resolve();
    await removal;
    await expect(issuance).rejects.toThrow();
    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(0);
  });

  it('serializes token-first so later membership removal purges the committed token', async () => {
    const { owner, guest } = await createPair('token-first');
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        members: { create: [{ userId: owner.id }, { userId: guest.id }] }
      }
    });
    const asset = await createAsset(owner.id, 'token-first', 'CONVERSATION', conversation.id);
    const tokenReady = deferred();
    const releaseToken = deferred();

    const issuance = prisma.$transaction(async (tx) => {
      await tx.mediaDownloadGrant.create({
        data: {
          assetId: asset.id,
          userId: guest.id,
          tokenHash: `kmd378-token-first-${sequence}-${Date.now()}`,
          expiresAt: new Date(Date.now() + 60_000)
        }
      });
      tokenReady.resolve();
      await releaseToken.promise;
    });

    await tokenReady.promise;

    let removalSettled = false;
    const removal = prisma.conversationMember
      .delete({ where: { conversationId_userId: { conversationId: conversation.id, userId: guest.id } } })
      .then(
        (value) => {
          removalSettled = true;
          return value;
        },
        (error) => {
          removalSettled = true;
          throw error;
        }
      );

    await sleep(100);
    expect(removalSettled).toBe(false);

    releaseToken.resolve();
    await issuance;
    await removal;
    expect(await prisma.mediaDownloadGrant.count({ where: { assetId: asset.id, userId: guest.id } })).toBe(0);
  });
});
