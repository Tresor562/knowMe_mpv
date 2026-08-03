import {
  canNotifyCaptureOwner,
  circleLimits,
  conceptKProfilePolicy,
  defaultProfileSectionRules,
  profileEvolutionTier,
  profileGuardPlatformPolicy,
  resolveGuardScopes,
  resolveProfileSectionAccess,
  validateProfileCircle
} from './profile-experience.domain';

describe('Concept K profile domain', () => {
  it('locks sensitive sections server-side for public viewers', () => {
    expect(
      resolveProfileSectionAccess({
        section: 'GIFTS',
        audience: 'PUBLIC',
        allowedWhenLocked: false,
        profileLocked: true,
        viewerRelation: 'PUBLIC'
      })
    ).toEqual({ visible: false, reason: 'PROFILE_LOCKED' });

    expect(
      resolveProfileSectionAccess({
        section: 'BIO',
        audience: 'PUBLIC',
        allowedWhenLocked: true,
        profileLocked: true,
        viewerRelation: 'PUBLIC'
      }).visible
    ).toBe(true);
  });

  it('unlocks friend-only sections after the viewer becomes a friend', () => {
    const before = resolveProfileSectionAccess({
      section: 'STATISTICS',
      audience: 'FRIENDS',
      allowedWhenLocked: true,
      profileLocked: true,
      viewerRelation: 'PUBLIC'
    });
    const after = resolveProfileSectionAccess({
      section: 'STATISTICS',
      audience: 'FRIENDS',
      allowedWhenLocked: true,
      profileLocked: true,
      viewerRelation: 'FRIEND'
    });
    expect(before.visible).toBe(false);
    expect(after.visible).toBe(true);
  });

  it('requires unanimous consent for a Duo and caps teams at seven', () => {
    expect(circleLimits('DUO_COUPLE').maximumMembers).toBe(2);
    expect(circleLimits('TEAM').maximumMembers).toBe(7);
    expect(() =>
      validateProfileCircle({
        type: 'DUO_BEST_FRIENDS',
        memberCount: 2,
        activeConsents: 1,
        level: 1,
        xp: 0
      })
    ).toThrow('accepter explicitement');
  });

  it('keeps baseline security free and reserves granular choices for Premium', () => {
    const free = resolveGuardScopes({
      enabled: true,
      requestedScopes: ['PROFILE'],
      hasPremiumEntitlement: false
    });
    expect(free.scopes).toEqual(
      expect.arrayContaining(['PROFILE', 'PAYMENTS', 'ADMIN', 'VIEW_ONCE_MEDIA'])
    );
    expect(free.baselineSecurityNeverPaywalled).toBe(true);

    expect(() =>
      resolveGuardScopes({
        enabled: true,
        requestedScopes: ['PROFILE', 'PRIVATE_MESSAGES'],
        hasPremiumEntitlement: false
      })
    ).toThrow('exige Premium');
  });

  it('does not promise impossible iOS screenshot blocking', () => {
    const ios = profileGuardPlatformPolicy('IOS');
    expect(ios.screenshotBlocking).toBe(false);
    expect(ios.absoluteGuarantee).toBe(false);
    expect(ios.screenshotDetection).toBe('AFTER_CAPTURE_NOTIFICATION');

    const android = profileGuardPlatformPolicy('ANDROID');
    expect(android.screenshotBlocking).toBe(true);
    expect(android.absoluteGuarantee).toBe(false);
  });

  it('only notifies from attested native capture signals', () => {
    expect(
      canNotifyCaptureOwner({
        notifyOwnerEnabled: true,
        nativeSignal: true,
        attestationValid: false,
        eventType: 'SCREENSHOT_COMPLETED'
      })
    ).toBe(false);
    expect(
      canNotifyCaptureOwner({
        notifyOwnerEnabled: true,
        nativeSignal: true,
        attestationValid: true,
        eventType: 'SCREENSHOT_COMPLETED'
      })
    ).toBe(true);
  });

  it('ties visual evolution to earned level rather than Premium', () => {
    expect(profileEvolutionTier(52)).toMatchObject({
      tier: 3,
      purchasable: false,
      premiumCanIncreaseTier: false
    });
    expect(defaultProfileSectionRules()).toHaveLength(17);
    expect(conceptKProfilePolicy().lockedProfile.serverEnforced).toBe(true);
  });
});
