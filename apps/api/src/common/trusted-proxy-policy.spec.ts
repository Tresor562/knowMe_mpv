import { createTrustedProxySetting } from './trusted-proxy-policy';

describe('createTrustedProxySetting', () => {
  it('does not trust forwarded client addresses by default outside production', () => {
    expect(createTrustedProxySetting({ NODE_ENV: 'test' })).toBe(0);
  });

  it('requires an explicit topology choice in production', () => {
    expect(() => createTrustedProxySetting({ NODE_ENV: 'production' })).toThrow(
      'TRUSTED_PROXY_HOPS must be explicitly configured in production.',
    );
  });

  it.each(['0', '1', '2', '5'])('accepts bounded canonical hop count %s', (value) => {
    expect(createTrustedProxySetting({ NODE_ENV: 'production', TRUSTED_PROXY_HOPS: value })).toBe(Number(value));
  });

  it.each(['-1', '6', '1.5', 'all', '1,2'])('rejects unsafe or ambiguous hop count %s', (value) => {
    expect(() => createTrustedProxySetting({ NODE_ENV: 'production', TRUSTED_PROXY_HOPS: value })).toThrow(
      /must be an integer between 0 and 5/,
    );
  });
});
