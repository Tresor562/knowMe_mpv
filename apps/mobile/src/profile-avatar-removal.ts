/**
 * Keep server mutation and client refresh as separate outcomes. A confirmed
 * server write must not be reported as a failed deletion just because the
 * UI refresh failed over an unreliable network.
 */
export async function removeActiveProfileAvatar(
  patchProfile: (payload: { avatarUrl: null }) => Promise<unknown>,
  refreshProfile: () => Promise<void>
): Promise<{ profileSynced: boolean }> {
  // A failed PATCH rejects; never optimistically discard the current picture.
  await patchProfile({ avatarUrl: null });
  try {
    await refreshProfile();
    return { profileSynced: true };
  } catch {
    // The server already accepted the write; do not send it again.
    return { profileSynced: false };
  }
}
