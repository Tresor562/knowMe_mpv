import {
  assertAttachmentAllowed,
  assertMessageEffectAllowed,
  messengerExperiencePolicy,
  statusExpiresAt,
  validateConversationAppearance
} from './messenger-experience.domain';

describe('messenger experience domain', () => {
  it('keeps classic messaging separate from KnowMe Secret', () => {
    expect(messengerExperiencePolicy()).toMatchObject({
      identityVisibleByDefault: true,
      anonymousMessagingIncluded: false,
      anonymousProduct: 'KNOWME_SECRET'
    });
  });

  it('allows free static personalization but protects premium animated themes', () => {
    expect(() =>
      validateConversationAppearance(
        {
          bubbleStyle: 'KNOWME',
          backgroundSource: 'SYSTEM_GRADIENT',
          backgroundAssetId: null,
          blur: 10,
          brightness: 80,
          opacity: 75,
          colorFilter: null,
          animationEnabled: false,
          reduceMotionOverride: false,
          showAvatarsBesideMessages: true
        },
        { hasPremiumEntitlement: false, assetModerated: true }
      )
    ).not.toThrow();

    expect(() =>
      validateConversationAppearance(
        {
          bubbleStyle: 'MODERN',
          backgroundSource: 'ANIMATED_CATALOG',
          backgroundAssetId: 'sakura-galaxy',
          blur: 0,
          brightness: 100,
          opacity: 100,
          colorFilter: null,
          animationEnabled: true,
          reduceMotionOverride: false,
          showAvatarsBesideMessages: true
        },
        { hasPremiumEntitlement: false, assetModerated: true }
      )
    ).toThrow('Premium');
  });

  it('requires personal backgrounds to be stored and moderated', () => {
    expect(() =>
      validateConversationAppearance(
        {
          bubbleStyle: 'CLEAN',
          backgroundSource: 'USER_GALLERY',
          backgroundAssetId: 'asset-1',
          blur: 20,
          brightness: 80,
          opacity: 70,
          colorFilter: 'purple',
          animationEnabled: false,
          reduceMotionOverride: false,
          showAvatarsBesideMessages: false
        },
        { hasPremiumEntitlement: false, assetModerated: false }
      )
    ).toThrow('modéré');
  });

  it('respects recipient effects and reduced motion preferences', () => {
    expect(
      assertMessageEffectAllowed('LOVE', {
        reduceMotion: true,
        recipientAllowsEffects: true
      })
    ).toBe('NONE');
    expect(
      assertMessageEffectAllowed('VICTORY', {
        reduceMotion: false,
        recipientAllowsEffects: true
      })
    ).toBe('VICTORY');
  });

  it('checks file limits, malware scanning and moderation', () => {
    expect(() =>
      assertAttachmentAllowed('DOCUMENT', 1000, {
        hasPremiumEntitlement: false,
        malwareScanPassed: true,
        contentModerationPassed: true
      })
    ).not.toThrow();

    expect(() =>
      assertAttachmentAllowed('ARCHIVE', 1000, {
        hasPremiumEntitlement: true,
        malwareScanPassed: false,
        contentModerationPassed: true
      })
    ).toThrow('sécurité');
  });

  it('expires classic statuses exactly 24 hours later', () => {
    const created = new Date('2026-08-03T10:00:00.000Z');
    expect(statusExpiresAt(created).toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });
});
