import {
  assertShortLinkTarget,
  generateShortLinkCode,
  isShortLinkActive,
  isValidShortLinkCode,
  normalizeShortLinkExpiry,
  SHORT_LINK_MAX_TTL_MS
} from './short-link.domain';

describe('short-link domain policy', () => {
  it('generates opaque URL-safe 128-bit-class codes with stable length', () => {
    const codes = new Set(Array.from({ length: 64 }, () => generateShortLinkCode()));
    expect(codes.size).toBe(64);
    for (const code of codes) {
      expect(isValidShortLinkCode(code)).toBe(true);
      expect(code).toHaveLength(16);
    }
  });

  it('accepts only KMD-060 target kinds and opaque safe identifiers', () => {
    expect(assertShortLinkTarget('challenge', 'chl_abcdef12')).toEqual({
      kind: 'challenge',
      id: 'chl_abcdef12'
    });
    expect(() => assertShortLinkTarget('admin', 'usr_123456')).toThrow(
      'SHORT_LINK_KIND_UNSUPPORTED'
    );
    expect(() => assertShortLinkTarget('profile', '../admin')).toThrow(
      'SHORT_LINK_TARGET_INVALID'
    );
  });

  it('bounds optional expiry to the initial ninety-day policy', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');
    const valid = new Date(now.getTime() + SHORT_LINK_MAX_TTL_MS);
    expect(normalizeShortLinkExpiry(valid, now)).toEqual(valid);
    expect(
      () => normalizeShortLinkExpiry(new Date(now.getTime() - 1), now)
    ).toThrow('SHORT_LINK_EXPIRY_INVALID');
    expect(
      () => normalizeShortLinkExpiry(new Date(valid.getTime() + 1), now)
    ).toThrow('SHORT_LINK_EXPIRY_TOO_FAR');
  });

  it('treats revoked and expired links as inactive', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');
    expect(isShortLinkActive({ expiresAt: null, revokedAt: null }, now)).toBe(true);
    expect(
      isShortLinkActive(
        { expiresAt: new Date(now.getTime() + 1000), revokedAt: null },
        now
      )
    ).toBe(true);
    expect(
      isShortLinkActive(
        { expiresAt: new Date(now.getTime()), revokedAt: null },
        now
      )
    ).toBe(false);
    expect(
      isShortLinkActive({ expiresAt: null, revokedAt: new Date(now) }, now)
    ).toBe(false);
  });
});
