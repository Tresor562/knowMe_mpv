import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

describe('MediaQuarantineOpsService', () => {
  it('returns only bounded aggregate quarantine state', async () => {
    const oldest = new Date('2026-08-25T05:00:00.000Z');
    const mediaAsset = {
      count: jest
        .fn()
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5),
      findFirst: jest.fn().mockResolvedValue({ createdAt: oldest })
    };
    const prisma = {
      mediaAsset,
      $transaction: jest.fn(async (queries: Promise<unknown>[]) => Promise.all(queries))
    };

    const service = new MediaQuarantineOpsService(prisma as never);

    await expect(service.getSnapshot()).resolves.toEqual({
      quarantined: 7,
      infected: 2,
      unavailable: 5,
      oldestQuarantinedAt: oldest
    });

    expect(mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { status: 'QUARANTINED', deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { createdAt: true }
    });
  });

  it('returns a null oldest timestamp for an empty quarantine', async () => {
    const prisma = {
      mediaAsset: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn(async (queries: Promise<unknown>[]) => Promise.all(queries))
    };

    const service = new MediaQuarantineOpsService(prisma as never);

    await expect(service.getSnapshot()).resolves.toEqual({
      quarantined: 0,
      infected: 0,
      unavailable: 0,
      oldestQuarantinedAt: null
    });
  });
});
