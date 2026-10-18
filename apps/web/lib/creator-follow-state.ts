/** Public creator subscriptions use authenticated server snapshots. */
export type CreatorFollowSnapshot = {
  following: boolean;
  isOwner: boolean;
  followerCount: number;
};
export type CreatorFollowMutation = {
  following: boolean;
  replayed: boolean;
};

/** Only a server-confirmed write may change the visible follow state. */
export function applyCreatorFollowMutation(
  snapshot: CreatorFollowSnapshot,
  response: CreatorFollowMutation
): CreatorFollowSnapshot {
  if (snapshot.isOwner) return snapshot;
  const delta = response.replayed ? 0 : response.following ? 1 : -1;
  return {
    ...snapshot,
    following: response.following,
    followerCount: Math.max(0, snapshot.followerCount + delta)
  };
}

export function creatorFollowAction(
  authenticated: boolean, snapshot: CreatorFollowSnapshot | null
): 'login' | 'refresh' | 'owner' | 'follow' | 'unfollow' {
  if (!authenticated) return 'login';
  if (!snapshot) return 'refresh';
  if (snapshot.isOwner) return 'owner';
  return snapshot.following ? 'unfollow' : 'follow';
}
