import { ConceptKAssetsService } from './concept-k-assets.service';

describe('ConceptKAssetsService', () => {
  it('assigns a stable rollout bucket between zero and ninety-nine', () => {
    const service = new ConceptKAssetsService({} as never, {} as never, {} as never);

    const first = service.deterministicBucket('user-1', 'asset-1');
    const replay = service.deterministicBucket('user-1', 'asset-1');
    const other = service.deterministicBucket('user-2', 'asset-1');

    expect(first).toBe(replay);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
    expect(other).toBeGreaterThanOrEqual(0);
    expect(other).toBeLessThan(100);
  });

  it('returns the static fallback without querying assets when animations are off', async () => {
    const prisma = {
      conceptKAssetManifest: {
        findMany: jest.fn()
      }
    };
    const conceptK = {
      resolve: jest.fn().mockResolvedValue({
        preference: { mode: 'OFF' },
        plan: {
          catalogVersion: 1,
          variant: 'STATIC',
          reason: 'USER_DISABLED',
          event: {
            fallbackSymbol: '↑',
            fallbackLabel: 'Niveau supérieur'
          }
        }
      })
    };
    const service = new ConceptKAssetsService(
      prisma as never,
      conceptK as never,
      {} as never
    );

    const result = await service.resolve('user-1', {
      eventKey: 'LEVEL_UP',
      clientReducedMotion: false,
      deviceClass: 'HIGH',
      platform: 'WEB'
    });

    expect(result).toEqual(
      expect.objectContaining({
        deliveryVariant: 'STATIC',
        asset: null,
        fallback: expect.objectContaining({
          symbol: '↑',
          label: 'Niveau supérieur',
          reason: 'STATIC_PLAN'
        }),
        rules: expect.objectContaining({
          integrityRequired: true,
          staticFallbackRequired: true,
          paidPriorityAllowed: false
        })
      })
    );
    expect(prisma.conceptKAssetManifest.findMany).not.toHaveBeenCalled();
  });
});
