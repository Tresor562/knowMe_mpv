/**
 * A single HTTP byte range for already-authorized public MP4 assets.
 * The current storage interface returns a Buffer; this parser enables
 * seek-compatible HTTP responses, not true storage-level range reads.
 */
export function parseSingleByteRange(
  header: string,
  total: number
): {start: number;end: number} | null {
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  if (header.length > 80) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return null;
  const first = match[1] ?? '';
  const last = match[2] ?? '';
  if (first === '' && last === '') return null;

  if (first === '') {
    const suffix = Number(last);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return {start: Math.max(0,total - suffix),end:total - 1};
  }

  const start = Number(first);
  if (!Number.isSafeInteger(start) || start < 0 || start >= total) return null;
  if (last === '') return {start,end:total - 1};
  const requestedEnd = Number(last);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  return {start,end:Math.min(requestedEnd,total - 1)};
}
