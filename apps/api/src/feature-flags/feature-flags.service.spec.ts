import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  function setup(
    flag: Record<string, unknown> | null,
    override: unknown = null
  ) {
    const prisma = {
      featureFlag: {
        findUnique: jest.fn().mockResolvedValue(flag)
      },
      featureFlagOverride: {
        findUnique: jest.fn().mockResolvedValue(override)
      }
    };

    return {
      service: new FeatureFlagsService(prisma as never),
      prisma
    };
  }

  const baseFlag = {
    id: 'flag-1',
    key: 'concept-k',
    description: null,
    enabled: true,
    exposeToClient: true,
    riskLevel: 'NORMAL',
    owner: null,
    reviewAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    rules: []
  };

  it('keeps the global switch authoritative', async () => {
    const { service } = setup(
      { ...baseFlag, enabled: false },
      { enabled: true, expiresAt: null }
    );

    await expect(
      service.evaluate('concept-k', {
        userId: 'alice',
        platform: 'web'
      })
    ).resolves.toBe(false);
  });

  it('applies an active user override before targeting rules', async () => {
    const { service } = setup(
      {
        ...baseFlag,
        rules: [
          {
            id: 'rule-1',
            flagId: 'flag-1',
            enabled: false,
            platform: null,
            country: null,
            minVersion: null,
            rolloutPercentage: null,
            audience: null,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      },
      { enabled: true, expiresAt: null }
    );

    await expect(
      service.evaluate('concept-k', { userId: 'alice' })
    ).resolves.toBe(true);
  });

  it('matches platform, country and minimum version rules', async () => {
    const { service } = setup({
      ...baseFlag,
      rules: [
        {
          id: 'rule-1',
          flagId: 'flag-1',
          enabled: false,
          platform: 'android',
          country: 'BJ',
          minVersion: '2.1.0',
          rolloutPercentage: null,
          audience: null,
          priority: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });

    await expect(
      service.evaluate('concept-k', {
        userId: 'alice',
        platform: 'android',
        country: 'bj',
        version: '2.1.1'
      })
    ).resolves.toBe(false);
  });

  it('ignores expired overrides', async () => {
    const { service } = setup(
      {
        ...baseFlag,
        rules: [
          {
            id: 'rule-1',
            flagId: 'flag-1',
            enabled: false,
            platform: null,
            country: null,
            minVersion: null,
            rolloutPercentage: null,
            audience: null,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      },
      { enabled: true, expiresAt: new Date(Date.now() - 1_000) }
    );

    await expect(
      service.evaluate('concept-k', { userId: 'alice' })
    ).resolves.toBe(false);
  });

  it('returns false for unknown flags', async () => {
    const { service } = setup(null);

    await expect(
      service.evaluate('missing', { userId: 'alice' })
    ).resolves.toBe(false);
  });
});
