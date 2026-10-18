/** A server cosmetic badge must never be displayed on a different account. */
export type AndroidBadgeSnapshot<T> = {
  username: string;
  badges: readonly T[];
};

export function badgeIdentityKey(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase();
}

export function badgesForAndroidProfile<T>(
  username: string,
  latest: AndroidBadgeSnapshot<T> | null,
  cache: ReadonlyMap<string, readonly T[]>
): readonly T[] {
  const key = badgeIdentityKey(username);
  if (!key) return [];
  if (latest?.username === key) return latest.badges;
  return cache.get(key) ?? [];
}
