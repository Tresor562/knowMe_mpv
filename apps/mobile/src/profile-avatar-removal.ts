/**
 * Update the authoritative profile before refreshing the displayed user.
 * A network or validation failure must never optimistically clear the avatar.
 */
export async function removeActiveProfileAvatar(
  patchProfile: (payload: { avatarUrl: null }) => Promise<unknown>,
  refreshProfile: () => Promise<void>
): Promise<void> {
  await patchProfile({ avatarUrl: null });
  await refreshProfile();
}
