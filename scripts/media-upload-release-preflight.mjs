const MIN_BYTES = 1 * 1024 * 1024;
const MAX_BYTES = 25 * 1024 * 1024;

export function validateMediaUploadReleasePolicy(env = process.env) {
  const raw = env.MEDIA_UPLOAD_MAX_BYTES?.trim();
  if (!raw) throw new Error('MEDIA_UPLOAD_MAX_BYTES is required for a market release.');
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error('MEDIA_UPLOAD_MAX_BYTES must be a canonical positive integer.');
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < MIN_BYTES || value > MAX_BYTES) {
    throw new Error(`MEDIA_UPLOAD_MAX_BYTES must be between ${MIN_BYTES} and ${MAX_BYTES}.`);
  }
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validateMediaUploadReleasePolicy(process.env);
    console.log('Media upload release preflight passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Media upload release preflight failed.');
    process.exitCode = 1;
  }
}
