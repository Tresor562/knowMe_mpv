const DEFAULT_MEDIA_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const MIN_MEDIA_UPLOAD_MAX_BYTES = 1 * 1024 * 1024;
const MAX_MEDIA_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export function resolveMediaUploadMaxBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MEDIA_UPLOAD_MAX_BYTES?.trim();
  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MEDIA_UPLOAD_MAX_BYTES is required in production.');
    }
    return DEFAULT_MEDIA_UPLOAD_MAX_BYTES;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error('MEDIA_UPLOAD_MAX_BYTES must be a canonical positive integer.');
  }

  const parsed = Number(raw);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_MEDIA_UPLOAD_MAX_BYTES ||
    parsed > MAX_MEDIA_UPLOAD_MAX_BYTES
  ) {
    throw new Error(
      `MEDIA_UPLOAD_MAX_BYTES must be between ${MIN_MEDIA_UPLOAD_MAX_BYTES} and ${MAX_MEDIA_UPLOAD_MAX_BYTES}.`,
    );
  }

  return parsed;
}
