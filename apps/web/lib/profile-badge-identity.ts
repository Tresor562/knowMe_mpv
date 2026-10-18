/** Prevent decorative badges from a previous profile being shown on a new one. */
export type ProfileBadgeSnapshot<T> = {
  username: string;
  badges: readonly T[];
};

export function badgeUsernameKey(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase();
}

/** The active profile identity always controls which badges are visible. */
export function badgesForProfile<T>(
  username: string,
  latest: ProfileBadgeSnapshot<T> | null,
  cache: ReadonlyMap<string, readonly T[]>
): readonly T[] {
  const key = badgeUsernameKey(username);
  if (!key) return [];
  if (latest?.username === key) return latest.badges;
  return cache.get(key) ?? [];
}
