import {
  DEFAULT_MEDIA_DOWNLOAD_PREFERENCE,
  decideMediaDownload,
  mediaKindFromMime,
  normalizeMediaDownloadPreference
} from '@knowme/media-cache-contract';

describe('KMD-050 media cache policy', () => {
  it('normalizes kinds and bounds the local quota', () => {
    expect(normalizeMediaDownloadPreference({
      wifiKinds: ['VIDEO', 'IMAGE', 'INVALID'] as never,
      maxCacheMb: 9
    })).toEqual(expect.objectContaining({
      wifiKinds: ['IMAGE', 'VIDEO'],
      cellularKinds: ['IMAGE'],
      roamingKinds: [],
      maxCacheMb: 64
    }));
    expect(normalizeMediaDownloadPreference({ maxCacheMb: 99999 }).maxCacheMb).toBe(4096);
  });

  it('allows Wi-Fi kinds but denies roaming by default', () => {
    expect(decideMediaDownload({
      preference: { ...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE },
      kind: 'VIDEO',
      network: 'WIFI'
    })).toMatchObject({ allowed: true, reason: 'ALLOWED' });
    expect(decideMediaDownload({
      preference: { ...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE },
      kind: 'IMAGE',
      network: 'ROAMING'
    })).toMatchObject({ allowed: false, reason: 'KIND_DISABLED', previewOnly: true });
  });

  it('honors data saver, background and cache limits', () => {
    expect(decideMediaDownload({
      preference: { ...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE },
      kind: 'IMAGE', network: 'CELLULAR', dataSaverEnabled: true
    }).reason).toBe('DATA_SAVER');
    expect(decideMediaDownload({
      preference: { ...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE },
      kind: 'IMAGE', network: 'WIFI', isBackground: true
    }).reason).toBe('BACKGROUND_DISABLED');
    expect(decideMediaDownload({
      preference: { ...DEFAULT_MEDIA_DOWNLOAD_PREFERENCE, maxCacheMb: 64 },
      kind: 'IMAGE', network: 'WIFI', cachedBytes: 63 * 1024 * 1024, incomingBytes: 2 * 1024 * 1024
    }).reason).toBe('CACHE_LIMIT');
  });

  it('maps MIME types without trusting file names', () => {
    expect(mediaKindFromMime('image/webp')).toBe('IMAGE');
    expect(mediaKindFromMime('video/mp4')).toBe('VIDEO');
    expect(mediaKindFromMime('audio/ogg')).toBe('AUDIO');
    expect(mediaKindFromMime('application/pdf')).toBe('FILE');
  });
});
