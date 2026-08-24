import {
  createApiRateLimitPolicy,
  DEFAULT_API_RATE_LIMIT_LIMIT,
  DEFAULT_API_RATE_LIMIT_TTL_MS,
} from './api-rate-limit-policy';

describe('createApiRateLimitPolicy', () => {
  it('uses bounded development defaults when values are omitted outside production', () => {
    expect(createApiRateLimitPolicy({ NODE_ENV: 'test' })).toEqual({
      ttl: DEFAULT_API_RATE_LIMIT_TTL_MS,
      limit: DEFAULT_API_RATE_LIMIT_LIMIT,
    });
  });

  it('requires an explicit production instance count before the rate-limit values', () => {
    expect(() => createApiRateLimitPolicy({ NODE_ENV: 'production' })).toThrow(
      'API_INSTANCE_COUNT must be explicitly configured in production while rate limiting uses process-local storage',
    );
  });

  it('requires explicit rate-limit values in production after topology is valid', () => {
    expect(() =>
      createApiRateLimitPolicy({ NODE_ENV: 'production', API_INSTANCE_COUNT: '1' }),
    ).toThrow('API_RATE_LIMIT_TTL_MS must be explicitly configured in production');
  });

  it('accepts explicit bounded production values on the supported single-instance topology', () => {
    expect(
      createApiRateLimitPolicy({
        NODE_ENV: 'production',
        API_INSTANCE_COUNT: '1',
        API_RATE_LIMIT_TTL_MS: '60000',
        API_RATE_LIMIT_LIMIT: '120',
      }),
    ).toEqual({ ttl: 60000, limit: 120 });
  });

  it.each(['0', '2', '8', '-1', '1.5', '01', 'many'])(
    'rejects unsupported production API_INSTANCE_COUNT=%s at runtime',
    (value) => {
      expect(() =>
        createApiRateLimitPolicy({
          NODE_ENV: 'production',
          API_INSTANCE_COUNT: value,
          API_RATE_LIMIT_TTL_MS: '60000',
          API_RATE_LIMIT_LIMIT: '120',
        }),
      ).toThrow(/API_INSTANCE_COUNT must/);
    },
  );

  it.each([
    ['API_RATE_LIMIT_TTL_MS', '0'],
    ['API_RATE_LIMIT_TTL_MS', '3600001'],
    ['API_RATE_LIMIT_TTL_MS', '1.5'],
    ['API_RATE_LIMIT_LIMIT', '0'],
    ['API_RATE_LIMIT_LIMIT', '100001'],
    ['API_RATE_LIMIT_LIMIT', 'many'],
  ])('rejects invalid %s=%s', (key, value) => {
    const env = {
      NODE_ENV: 'production',
      API_INSTANCE_COUNT: '1',
      API_RATE_LIMIT_TTL_MS: '60000',
      API_RATE_LIMIT_LIMIT: '120',
      [key]: value,
    };
    expect(() => createApiRateLimitPolicy(env)).toThrow(/must be an integer between/);
  });
});
