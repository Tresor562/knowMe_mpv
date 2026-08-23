import {
  canPersistGuestGameplay,
  GUEST_GAME_SESSION_TTL_MS,
  guestGameSessionExpiry,
  guestGameplayStoragePolicy
} from './guest-game-session.policy';

describe('guest gameplay persistence policy', () => {
  const now = new Date('2026-08-23T17:00:00.000Z');

  it('keeps guest gameplay isolated from account-bound game storage', () => {
    expect(guestGameplayStoragePolicy()).toEqual({
      usesAccountGameSession: false,
      storesAccountUserId: false,
      requiresActiveGuestIdentity: true,
      authoritativeStateRequired: true,
      idempotencyReceiptRequired: true,
      cascadeDeleteWithGuestIdentity: true,
      publicGameplayEnabledByThisKmd: false
    });
  });

  it('allows persistence only for an active non-converted unexpired guest', () => {
    expect(
      canPersistGuestGameplay(
        {
          status: 'ACTIVE',
          convertedUserId: null,
          expiresAt: new Date('2026-08-23T18:00:00.000Z')
        },
        now
      )
    ).toBe(true);

    for (const status of ['REVOKED', 'CONVERTED', 'BLOCKED'] as const) {
      expect(
        canPersistGuestGameplay(
          {
            status,
            convertedUserId: null,
            expiresAt: new Date('2026-08-23T18:00:00.000Z')
          },
          now
        )
      ).toBe(false);
    }

    expect(
      canPersistGuestGameplay(
        {
          status: 'ACTIVE',
          convertedUserId: 'user-1',
          expiresAt: new Date('2026-08-23T18:00:00.000Z')
        },
        now
      )
    ).toBe(false);

    expect(
      canPersistGuestGameplay(
        {
          status: 'ACTIVE',
          convertedUserId: null,
          expiresAt: now
        },
        now
      )
    ).toBe(false);
  });

  it('never lets a gameplay session outlive its guest identity', () => {
    expect(GUEST_GAME_SESSION_TTL_MS).toBe(30 * 60 * 1000);
    expect(
      guestGameSessionExpiry(
        new Date('2026-08-23T17:10:00.000Z'),
        now
      ).toISOString()
    ).toBe('2026-08-23T17:10:00.000Z');
    expect(
      guestGameSessionExpiry(
        new Date('2026-08-23T19:00:00.000Z'),
        now
      ).toISOString()
    ).toBe('2026-08-23T17:30:00.000Z');
  });
});
