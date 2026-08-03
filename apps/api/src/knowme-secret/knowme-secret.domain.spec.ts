import {
  SecretInboxPreferences,
  assertSecretMessageAllowed,
  knowMeSecretPolicy,
  normalizeSecretSlug,
  resolvePrivacySafeHint,
  validateSecretAppearance
} from './knowme-secret.domain';

const preferences: SecretInboxPreferences = {
  enabled: true,
  acceptQuestions: true,
  acceptCompliments: true,
  acceptConfessions: true,
  acceptFeedback: true,
  minimumAccountAgeHours: 24,
  allowUnauthenticatedSenders: false,
  requireChallengeVerification: true,
  blockedTerms: ['insulte-test'],
  deliveryDelaySeconds: 30
};

describe('KnowMe Secret domain', () => {
  it('stays technically separate from normal Messenger', () => {
    expect(knowMeSecretPolicy()).toMatchObject({
      separateFromMessenger: true,
      identityHiddenFromRecipient: true,
      premiumCanRevealIdentity: false,
      premiumCanRevealIpAddress: false,
      premiumCanRevealExactLocation: false
    });
  });

  it('normalizes safe public Secret links', () => {
    expect(normalizeSecretSlug('  Tresor-Secret ')).toBe('tresor-secret');
    expect(() => normalizeSecretSlug('bad slug!')).toThrow('invalide');
  });

  it('moderates anonymous messages before delivery', () => {
    expect(() =>
      assertSecretMessageAllowed(
        {
          category: 'COMPLIMENT',
          content: 'Tu inspires beaucoup de personnes.',
          senderAuthenticated: true,
          senderAccountAgeHours: 100,
          challengeVerificationPassed: true,
          moderationPassed: true,
          harassmentRiskScore: 5,
          repeatedSubmissionCount24h: 0,
          recipientBlockedSenderToken: false
        },
        preferences
      )
    ).not.toThrow();

    expect(() =>
      assertSecretMessageAllowed(
        {
          category: 'CONFESSION',
          content: 'Message malveillant',
          senderAuthenticated: true,
          senderAccountAgeHours: 100,
          challengeVerificationPassed: true,
          moderationPassed: false,
          harassmentRiskScore: 90,
          repeatedSubmissionCount24h: 0,
          recipientBlockedSenderToken: false
        },
        preferences
      )
    ).toThrow('anti-harcèlement');
  });

  it('lets recipients block an anonymous sender without learning identity', () => {
    expect(() =>
      assertSecretMessageAllowed(
        {
          category: 'QUESTION',
          content: 'Question répétée',
          senderAuthenticated: true,
          senderAccountAgeHours: 100,
          challengeVerificationPassed: true,
          moderationPassed: true,
          harassmentRiskScore: 5,
          repeatedSubmissionCount24h: 1,
          recipientBlockedSenderToken: true
        },
        preferences
      )
    ).toThrow('bloqué');
  });

  it('only exposes voluntary or sufficiently aggregated Premium hints', () => {
    expect(
      resolvePrivacySafeHint({
        mode: 'SENDER_SELECTED_CONTEXT',
        hasPremiumEntitlement: true,
        senderConsented: true,
        senderSelectedContext: 'Une personne de ta communauté tech',
        anonymitySetSize: 1,
        privacyBudgetAvailable: false
      })
    ).toEqual({
      mode: 'SENDER_SELECTED_CONTEXT',
      value: 'Une personne de ta communauté tech',
      identityRevealed: false
    });

    expect(() =>
      resolvePrivacySafeHint({
        mode: 'COARSE_AGGREGATE',
        hasPremiumEntitlement: true,
        senderConsented: false,
        senderSelectedContext: null,
        anonymitySetSize: 3,
        privacyBudgetAvailable: true
      })
    ).toThrow('anonymat');
  });

  it('protects custom media and Premium-only music or animations', () => {
    expect(() =>
      validateSecretAppearance(
        {
          avatarAssetId: 'avatar-1',
          backgroundAssetId: 'background-1',
          accentColor: '#112233',
          secondaryColor: '#445566',
          musicAssetId: 'music-1',
          animationsEnabled: true,
          presentation: 'Pose-moi une question anonymement.',
          publicMessageCountVisible: true
        },
        { assetsModerated: true, hasPremiumEntitlement: true }
      )
    ).not.toThrow();
  });
});
