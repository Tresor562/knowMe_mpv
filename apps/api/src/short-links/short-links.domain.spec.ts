import { BadRequestException } from '@nestjs/common';
import {
  assertShortLinkKind,
  buildShortLinkDestination,
  normalizeShortCode,
  normalizeTargetId,
  shortLinkPolicy
} from './short-links.domain';

describe('KMD-061 short-link domain', () => {
  it('builds only the versioned canonical KMD-060 contract', () => {
    expect(buildShortLinkDestination('profile', 'tresor562')).toEqual({
      universalPath: '/open/v1/profile/tresor562',
      deepLink: 'knowme://v1/profile/tresor562'
    });
    expect(buildShortLinkDestination('challenge', 'chl_123456')).toEqual({
      universalPath: '/open/v1/challenge/chl_123456',
      deepLink: 'knowme://v1/challenge/chl_123456'
    });
  });

  it('rejects external URLs, traversal and kinds outside the shared contract', () => {
    for (const value of [
      'https://evil.example',
      'javascript:alert',
      '../admin',
      'with.dot',
      'short'
    ]) {
      expect(() => normalizeTargetId(value)).toThrow(BadRequestException);
    }
    expect(() => assertShortLinkKind('group')).toThrow(BadRequestException);
    expect(() => assertShortLinkKind('admin')).toThrow(BadRequestException);
  });

  it('accepts only 16-character base64url public codes', () => {
    expect(normalizeShortCode('Abcd_12345-xyzQQ')).toBe('Abcd_12345-xyzQQ');
    expect(() => normalizeShortCode('short')).toThrow(BadRequestException);
    expect(() => normalizeShortCode('aaaaaaaaaaaaaaa?')).toThrow(BadRequestException);
  });

  it('documents preview, privacy and rollout boundaries', () => {
    expect(shortLinkPolicy()).toMatchObject({
      contractVersion: 'v1',
      arbitraryExternalUrlsAllowed: false,
      rawIpAnalyticsStored: false,
      publicResolutionRevealsOwner: false,
      publicResolutionRevealsTargetId: false,
      authorizationRevalidatedOnResolve: true,
      creationFeatureFlag: 'short_links.creation'
    });
  });
});
