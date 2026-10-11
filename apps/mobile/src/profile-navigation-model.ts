/** Keep public profile targets consistent across KnowMe's native entry points. */
export function normalizeProfileUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const username = raw.trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{3,24}$/.test(username) ? username : null;
}
