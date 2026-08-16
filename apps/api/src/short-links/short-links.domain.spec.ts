import { BadRequestException } from '@nestjs/common';
import {
  assertShortLinkTargetType,
  buildShortLinkDestination,
  normalizeShortCode,
  normalizeTargetId,
  shortLinkPolicy
} from './short-links.domain';

describe('KMD-060 short-link domain', () => {
  it('builds only internal KnowMe destinations', () => {
    expect(buildShortLinkDestination('PROFILE', 'tresor562')).toEqual({
      webPath: '/profile/tresor562',
      deepLink: 'knowme://profile/tresor562'
    });
    expect(buildShortLinkDestination('CHALLENGE', 'abc_123')).toEqual({
      webPath: '/challenges/abc_123',
      deepLink: 'knowme://challenge/abc_123'
    });
  });

  it('encodes gift and sticker identifiers as query parameters', () => {
    expect(buildShortLinkDestination('GIFT', 'gift-123').webPath).toBe(
      '/gifts?gift=gift-123'
    );
    expect(buildShortLinkDestination('STICKER_PACK', 'pack-123').webPath).toBe(
      '/stickers?pack=pack-123'
    );
  });

  it('rejects schemes, path traversal and uncontrolled target types', () => {
    for (const value of [
      'https://evil.example',
      'javascript:alert(1)',
      '../admin',
      '/absolute/path'
    ]) {
      expect(() => normalizeTargetId(value)).toThrow(BadRequestException);
    }
    expect(() => assertShortLinkTargetType('EXTERNAL_URL')).toThrow(
      BadRequestException
    );
  });

  it('accepts only generated-code compatible characters and lengths', () => {
    expect(normalizeShortCode('Abcd_12345-xy')).toBe('Abcd_12345-xy');
    expect(() => normalizeShortCode('short')).toThrow(BadRequestException);
    expect(() => normalizeShortCode('aaaaaaaaaa?')).toThrow(BadRequestException);
  });

  it('documents privacy and rollout boundaries', () => {
    expect(shortLinkPolicy()).toMatchObject({
      arbitraryExternalUrlsAllowed: false,
      rawIpAnalyticsStored: false,
      publicResolutionRevealsOwner: false,
      creationFeatureFlag: 'short_links.creation'
    });
  });
});
