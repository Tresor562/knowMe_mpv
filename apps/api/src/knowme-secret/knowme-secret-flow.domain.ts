export const SECRET_ENTRY_POINTS = [
  'DEDICATED_APP',
  'PUBLIC_PROFILE_CTA',
  'SHARED_LINK',
  'QUESTION_CARD',
  'STATUS_OR_STORY',
  'QR_CODE',
  'DEEP_LINK'
] as const;
export type SecretEntryPoint = (typeof SECRET_ENTRY_POINTS)[number];

export const SECRET_CAMPAIGN_SOURCES = [
  'SHARED_LINK',
  'QUESTION_CARD',
  'STATUS_OR_STORY',
  'PROFILE',
  'QR_CODE'
] as const;
export type SecretCampaignSource = (typeof SECRET_CAMPAIGN_SOURCES)[number];

export type SecretPublicAccessInput = {
  pageEnabled: boolean;
  profileEntryEnabled: boolean;
  entryPoint: SecretEntryPoint;
  pausedUntil: Date | null;
  campaignStatus?: 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED' | null;
  campaignExpiresAt?: Date | null;
  campaignMaximumMessages?: number | null;
  campaignMessageCount?: number;
  now?: Date;
};

export function assertSecretPublicAccess(input: SecretPublicAccessInput): void {
  const now = input.now ?? new Date();
  if (!input.pageEnabled) throw new Error('Cette page Secret ne reçoit pas de messages.');
  if (input.pausedUntil && input.pausedUntil > now) {
    throw new Error('La réception des messages Secret est temporairement en pause.');
  }
  if (input.entryPoint === 'PUBLIC_PROFILE_CTA' && !input.profileEntryEnabled) {
    throw new Error('L’envoi anonyme depuis le profil est désactivé.');
  }
  if (input.campaignStatus) {
    if (input.campaignStatus !== 'ACTIVE') {
      throw new Error('Cette question partagée n’accepte plus de réponses.');
    }
    if (input.campaignExpiresAt && input.campaignExpiresAt <= now) {
      throw new Error('Cette question partagée a expiré.');
    }
    if (
      input.campaignMaximumMessages !== null &&
      input.campaignMaximumMessages !== undefined &&
      (input.campaignMessageCount ?? 0) >= input.campaignMaximumMessages
    ) {
      throw new Error('Cette question a atteint sa limite de réponses.');
    }
  }
}

export function secretDiscoveryPolicy() {
  return {
    primaryLocation: {
      route: '/secret',
      label: 'Secret',
      parent: 'Profil',
      onboardingCard: true,
      inboxBadge: true
    },
    secondaryLocations: [
      { surface: 'PUBLIC_PROFILE', action: 'Envoyer un message anonyme', enabledByOwner: true },
      { surface: 'PROFILE_EDITOR', action: 'Activer KnowMe Secret', enabledByOwner: true },
      { surface: 'SHARE_SHEET', action: 'Partager ma question', enabledByOwner: true },
      { surface: 'STATUS_COMPOSER', action: 'Ajouter une question Secret', enabledByOwner: true },
      { surface: 'MESSENGER_TOOLS', action: 'Ouvrir Secret', enabledByOwner: true }
    ],
    education: {
      firstActivationWalkthrough: true,
      explainIdentityProtection: true,
      explainProfileButton: true,
      explainPauseAndDisable: true,
      explainBlockAndReport: true,
      sampleQuestionTemplates: true
    }
  } as const;
}

export function secretScenarioCatalog() {
  return [
    'OWNER_HAS_NOT_ACTIVATED',
    'OWNER_ACTIVATES_AND_SHARES_GENERIC_LINK',
    'OWNER_POSTS_A_QUESTION_AND_SHARES_CAMPAIGN_LINK',
    'VISITOR_SENDS_FROM_PUBLIC_PROFILE',
    'VISITOR_SENDS_WITHOUT_KNOWME_ACCOUNT',
    'VISITOR_SENDS_WHILE_LOGGED_IN_BUT_REMAINS_ANONYMOUS',
    'PAGE_TEMPORARILY_PAUSED',
    'PAGE_DISABLED_AFTER_LINK_WAS_SHARED',
    'CAMPAIGN_EXPIRED',
    'CAMPAIGN_CLOSED_MANUALLY',
    'CAMPAIGN_REACHES_RESPONSE_LIMIT',
    'BLOCKED_SENDER_TRIES_AGAIN',
    'MESSAGE_MATCHES_HIDDEN_WORD',
    'MESSAGE_HAS_HIGH_HARASSMENT_RISK',
    'RATE_LIMIT_REACHED',
    'RECIPIENT_REPORTS_OR_BLOCKS_FROM_MESSAGE',
    'RECIPIENT_REPLIES_PRIVATELY_OR_PUBLISHES_A_CARD',
    'OWNER_ROTATES_OR_REVOKES_A_SHARED_LINK',
    'PROFILE_CTA_DISABLED_BUT_SHARED_LINK_REMAINS_ACTIVE',
    'ACCOUNT_SUSPENDED_OR_CONTENT_UNDER_REVIEW',
    'DELETED_ACCOUNT_AND_DATA_RETENTION',
    'NO_NETWORK_OR_DUPLICATE_SUBMISSION',
    'ACCESSIBILITY_AND_REDUCED_MOTION'
  ] as const;
}

export function knowMeSecretExtendedPolicy() {
  return {
    coreFlowMatchesAnonymousQa: {
      activatePersonalLink: true,
      shareLinkOutsideKnowMe: true,
      receiveAnonymousResponsesInInbox: true,
      answerAndReshare: true
    },
    knowMeAdvantages: {
      sendFromEnabledPublicProfile: true,
      questionSpecificCampaigns: true,
      multipleCategories: true,
      scheduledPause: true,
      expiringAndLimitedLinks: true,
      statusAndStoryIntegration: true,
      qrAndDeepLinks: true,
      avatarAndThemePersonalization: true,
      gamesChallengesAndGiftsIntegrationPlanned: true,
      opaqueSenderBlocking: true,
      privacySafeHintsOnly: true,
      noIdentityRevealForPremium: true
    },
    entryPoints: SECRET_ENTRY_POINTS,
    discovery: secretDiscoveryPolicy(),
    scenarios: secretScenarioCatalog()
  } as const;
}
