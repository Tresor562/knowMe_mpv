export const GUEST_GAME_SESSION_TTL_MS = 30 * 60 * 1000;

export type GuestGameplayIdentityState = {
  status: 'ACTIVE' | 'REVOKED' | 'CONVERTED' | 'BLOCKED';
  expiresAt: Date;
  convertedUserId: string | null;
};

export function guestGameplayStoragePolicy() {
  return {
    usesAccountGameSession: false,
    storesAccountUserId: false,
    requiresActiveGuestIdentity: true,
    authoritativeStateRequired: true,
    idempotencyReceiptRequired: true,
    cascadeDeleteWithGuestIdentity: true,
    publicGameplayEnabledByThisKmd: true
  } as const;
}

export function canPersistGuestGameplay(
  guest: GuestGameplayIdentityState,
  now = new Date()
) {
  return (
    guest.status === 'ACTIVE' &&
    guest.convertedUserId === null &&
    guest.expiresAt.getTime() > now.getTime()
  );
}

export function guestGameSessionExpiry(
  guestExpiresAt: Date,
  now = new Date()
) {
  const ttlExpiry = new Date(now.getTime() + GUEST_GAME_SESSION_TTL_MS);
  return ttlExpiry.getTime() < guestExpiresAt.getTime()
    ? ttlExpiry
    : new Date(guestExpiresAt.getTime());
}
