import { resolveMediaUploadMaxBytes } from './media-upload-policy';

describe('media upload memory policy', () => {
  it('keeps the existing 25 MiB limit outside production by default', () => {
    expect(resolveMediaUploadMaxBytes({ NODE_ENV: 'test' })).toBe(25 * 1024 * 1024);
  });

  it('requires an explicit upload budget in production', () => {
    expect(() => resolveMediaUploadMaxBytes({ NODE_ENV: 'production' })).toThrow(
      'MEDIA_UPLOAD_MAX_BYTES is required in production.',
    );
  });

  it('accepts the supported inclusive bounds', () => {
    expect(resolveMediaUploadMaxBytes({ NODE_ENV: 'production', MEDIA_UPLOAD_MAX_BYTES: '1048576' })).toBe(1048576);
    expect(resolveMediaUploadMaxBytes({ NODE_ENV: 'production', MEDIA_UPLOAD_MAX_BYTES: '26214400' })).toBe(26214400);
  });

  it.each(['0', '01', '1048575', '26214401', '1.5', '-1', 'abc'])(
    'rejects invalid MEDIA_UPLOAD_MAX_BYTES=%s',
    (value) => {
      expect(() =>
        resolveMediaUploadMaxBytes({ NODE_ENV: 'production', MEDIA_UPLOAD_MAX_BYTES: value }),
      ).toThrow();
    },
  );
});
