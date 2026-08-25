import {
  classifyMediaQuarantineReadiness,
  MediaQuarantineOpsService
} from './media-quarantine-ops.service';

describe('MediaQuarantineOpsService', () => {
  it('classifies quarantine state conservatively', () => {
    expect(
      classifyMediaQuarantineReadiness({ quarantined: 3, infected: 1, unavailable: 1 })
    ).toBe('BLOCKED_INFECTED');
    expect(
      classifyMediaQuarantineReadiness({ quarantined: 2, infected: 0, unavailable: 1 })
    ).toBe('BLOCKED_SCANNER_UNAVAILABLE');
    expect(
      classifyMediaQuarantineReadiness({ quarantined: 1, infected: 0, unavailable: 0 })
    ).toBe('PENDING_QUARANTINE');
    expect(
      classifyMediaQuarantineReadiness({ quarantined: 0, infected: 0, unavailable: 0 })
    ).toBe('CLEAR');
  });

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

    const service = new MediaQuarantineOpsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(service.getSnapshot()).resolves.toEqual({
      readiness: 'BLOCKED_INFECTED',
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

  it('returns a clear state and null oldest timestamp for an empty quarantine', async () => {
    const prisma = {
      mediaAsset: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn(async (queries: Promise<unknown>[]) => Promise.all(queries))
    };

    const service = new MediaQuarantineOpsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(service.getSnapshot()).resolves.toEqual({
      readiness: 'CLEAR',
      quarantined: 0,
      infected: 0,
      unavailable: 0,
      oldestQuarantinedAt: null
    });
  });
});
