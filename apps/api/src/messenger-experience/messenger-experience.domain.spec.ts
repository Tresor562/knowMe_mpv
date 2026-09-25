import {
  assertAttachmentAllowed,
  assertMessageEffectAllowed,
  assertVideoNoteAllowed,
  assertVoiceTransformAllowed,
  messengerExperiencePolicy,
  statusExpiresAt,
  validateConversationAppearance,
  validateConversationTranslationPreferences
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

  it('exposes video notes, full-conversation translation and voice transformation', () => {
    expect(messengerExperiencePolicy()).toMatchObject({
      attachments: expect.arrayContaining(['VIDEO_NOTE']),
      videoNotes: {
        enabled: true,
        previewBeforeSend: true
      },
      conversationTranslation: {
        enabled: true,
        wholeConversation: true,
        appLanguageTarget: true,
        customTargetLanguage: true,
        keepsOriginalMessage: true
      },
      voiceTransformation: {
        enabled: true,
        originalVoice: true,
        normalVoiceSendUnchanged: true,
        optInOnly: true,
        availableOnLockedOrDraftRecording: true,
        previewRequiredOnlyWhenTransformationRequested: true,
        resetsToOriginalForEveryNewRecording: true,
        systemPresetVoices: true
      }
    });
  });

  it('validates conversation translation targets', () => {
    expect(() =>
      validateConversationTranslationPreferences({
        mode: 'APP_LANGUAGE',
        targetLanguage: 'fr',
        showOriginalByDefault: false
      })
    ).not.toThrow();

    expect(() =>
      validateConversationTranslationPreferences({
        mode: 'CUSTOM_LANGUAGE',
        targetLanguage: 'pt-BR',
        showOriginalByDefault: true
      })
    ).not.toThrow();

    expect(() =>
      validateConversationTranslationPreferences({
        mode: 'OFF',
        targetLanguage: 'fr',
        showOriginalByDefault: true
      })
    ).toThrow('désactivée');
  });

  it('enforces the initial video-note duration policy', () => {
    expect(() =>
      assertVideoNoteAllowed(
        { durationSeconds: 42, sizeBytes: 2_000_000 },
        {
          hasPremiumEntitlement: false,
          malwareScanPassed: true,
          contentModerationPassed: true
        }
      )
    ).not.toThrow();

    expect(() =>
      assertVideoNoteAllowed(
        { durationSeconds: 61, sizeBytes: 2_000_000 },
        {
          hasPremiumEntitlement: false,
          malwareScanPassed: true,
          contentModerationPassed: true
        }
      )
    ).toThrow('60');
  });

  it('keeps original voice available and protects user voice profiles', () => {
    expect(() =>
      assertVoiceTransformAllowed(
        { source: 'ORIGINAL', voiceId: null },
        {
          selectedVoiceExists: false,
          selectedVoiceOwnedByUser: false,
          consentVerified: false,
          impersonationRisk: false
        }
      )
    ).not.toThrow();

    expect(() =>
      assertVoiceTransformAllowed(
        { source: 'USER_CONSENTED_PROFILE', voiceId: 'voice-me' },
        {
          selectedVoiceExists: true,
          selectedVoiceOwnedByUser: true,
          consentVerified: false,
          impersonationRisk: false
        }
      )
    ).toThrow('consentement');
  });

  it('expires classic statuses exactly 24 hours later', () => {
    const created = new Date('2026-08-03T10:00:00.000Z');
    expect(statusExpiresAt(created).toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });
});
