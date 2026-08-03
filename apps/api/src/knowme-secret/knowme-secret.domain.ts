export const SECRET_MESSAGE_CATEGORIES = [
  'QUESTION',
  'COMPLIMENT',
  'CONFESSION',
  'FEEDBACK'
] as const;
export type SecretMessageCategory = (typeof SECRET_MESSAGE_CATEGORIES)[number];

export const SECRET_HINT_MODES = [
  'NONE',
  'SENDER_SELECTED_CONTEXT',
  'COARSE_AGGREGATE'
] as const;
export type SecretHintMode = (typeof SECRET_HINT_MODES)[number];

export type SecretPageAppearance = {
  avatarAssetId: string | null;
  backgroundAssetId: string | null;
  accentColor: string;
  secondaryColor: string;
  musicAssetId: string | null;
  animationsEnabled: boolean;
  presentation: string;
  publicMessageCountVisible: boolean;
};

export type SecretInboxPreferences = {
  enabled: boolean;
  acceptQuestions: boolean;
  acceptCompliments: boolean;
  acceptConfessions: boolean;
  acceptFeedback: boolean;
  minimumAccountAgeHours: number;
  allowUnauthenticatedSenders: boolean;
  requireChallengeVerification: boolean;
  blockedTerms: string[];
  deliveryDelaySeconds: number;
};

export type SecretMessageCandidate = {
  category: SecretMessageCategory;
  content: string;
  senderAuthenticated: boolean;
  senderAccountAgeHours: number | null;
  challengeVerificationPassed: boolean;
  moderationPassed: boolean;
  harassmentRiskScore: number;
  repeatedSubmissionCount24h: number;
  recipientBlockedSenderToken: boolean;
};

export type SecretHintRequest = {
  mode: SecretHintMode;
  hasPremiumEntitlement: boolean;
  senderConsented: boolean;
  senderSelectedContext: string | null;
  anonymitySetSize: number;
  privacyBudgetAvailable: boolean;
};

const SECRET_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;
const MAX_PRESENTATION_LENGTH = 240;
const MAX_SECRET_MESSAGE_LENGTH = 2_000;
const MIN_ANONYMITY_SET_SIZE = 20;
const MAX_REPEATED_SUBMISSIONS_24H = 10;

export function normalizeSecretSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SECRET_SLUG.test(normalized)) {
    throw new Error('Identifiant public Secret invalide.');
  }
  return normalized;
}

export function validateSecretAppearance(
  appearance: SecretPageAppearance,
  context: { assetsModerated: boolean; hasPremiumEntitlement: boolean }
): void {
  if (appearance.presentation.trim().length > MAX_PRESENTATION_LENGTH) {
    throw new Error('Présentation Secret trop longue.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(appearance.accentColor)) {
    throw new Error('Couleur principale invalide.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(appearance.secondaryColor)) {
    throw new Error('Couleur secondaire invalide.');
  }
  if (
    [appearance.avatarAssetId, appearance.backgroundAssetId, appearance.musicAssetId].some(
      Boolean
    ) &&
    !context.assetsModerated
  ) {
    throw new Error('Les médias de la page Secret doivent être modérés.');
  }
  if (
    (appearance.musicAssetId || appearance.animationsEnabled) &&
    !context.hasPremiumEntitlement
  ) {
    throw new Error('La musique et les animations complètes exigent Premium.');
  }
}

export function validateSecretInboxPreferences(
  preferences: SecretInboxPreferences
): void {
  if (
    !Number.isInteger(preferences.minimumAccountAgeHours) ||
    preferences.minimumAccountAgeHours < 0 ||
    preferences.minimumAccountAgeHours > 24 * 365
  ) {
    throw new Error('Ancienneté minimale invalide.');
  }
  if (
    !Number.isInteger(preferences.deliveryDelaySeconds) ||
    preferences.deliveryDelaySeconds < 0 ||
    preferences.deliveryDelaySeconds > 24 * 60 * 60
  ) {
    throw new Error('Délai de livraison invalide.');
  }
  if (preferences.blockedTerms.length > 500) {
    throw new Error('Trop de termes bloqués.');
  }
  if (preferences.blockedTerms.some((term) => term.trim().length < 2)) {
    throw new Error('Terme bloqué invalide.');
  }
}

export function assertSecretMessageAllowed(
  candidate: SecretMessageCandidate,
  preferences: SecretInboxPreferences
): void {
  validateSecretInboxPreferences(preferences);
  if (!preferences.enabled) throw new Error('Cette page Secret est désactivée.');
  if (!SECRET_MESSAGE_CATEGORIES.includes(candidate.category)) {
    throw new Error('Catégorie Secret inconnue.');
  }
  const categoryAllowed = {
    QUESTION: preferences.acceptQuestions,
    COMPLIMENT: preferences.acceptCompliments,
    CONFESSION: preferences.acceptConfessions,
    FEEDBACK: preferences.acceptFeedback
  }[candidate.category];
  if (!categoryAllowed) throw new Error('Cette catégorie n’est pas acceptée.');

  const content = candidate.content.trim();
  if (!content || content.length > MAX_SECRET_MESSAGE_LENGTH) {
    throw new Error('Longueur du message Secret invalide.');
  }
  if (
    preferences.blockedTerms.some((term) =>
      content.toLocaleLowerCase('fr').includes(term.trim().toLocaleLowerCase('fr'))
    )
  ) {
    throw new Error('Le message contient un terme bloqué par le destinataire.');
  }
  if (!candidate.senderAuthenticated && !preferences.allowUnauthenticatedSenders) {
    throw new Error('Un compte KnowMe est requis pour envoyer ce message.');
  }
  if (
    candidate.senderAuthenticated &&
    (candidate.senderAccountAgeHours ?? 0) < preferences.minimumAccountAgeHours
  ) {
    throw new Error('Le compte expéditeur est trop récent.');
  }
  if (
    preferences.requireChallengeVerification &&
    !candidate.challengeVerificationPassed
  ) {
    throw new Error('La vérification anti-robot est requise.');
  }
  if (!candidate.moderationPassed || candidate.harassmentRiskScore >= 70) {
    throw new Error('Le message a été bloqué par la protection anti-harcèlement.');
  }
  if (candidate.repeatedSubmissionCount24h >= MAX_REPEATED_SUBMISSIONS_24H) {
    throw new Error('Limite quotidienne de messages Secret atteinte.');
  }
  if (candidate.recipientBlockedSenderToken) {
    throw new Error('Cet expéditeur anonyme est bloqué pour ce destinataire.');
  }
}

export function resolvePrivacySafeHint(request: SecretHintRequest): {
  mode: SecretHintMode;
  value: string | null;
  identityRevealed: false;
} {
  if (!SECRET_HINT_MODES.includes(request.mode)) throw new Error('Mode d’indice inconnu.');
  if (request.mode === 'NONE') {
    return { mode: 'NONE', value: null, identityRevealed: false };
  }
  if (!request.hasPremiumEntitlement) {
    throw new Error('Les indices de contexte exigent Premium.');
  }
  if (request.mode === 'SENDER_SELECTED_CONTEXT') {
    if (!request.senderConsented || !request.senderSelectedContext?.trim()) {
      throw new Error('L’expéditeur doit choisir et accepter cet indice.');
    }
    const safeValue = request.senderSelectedContext.trim().slice(0, 40);
    return {
      mode: request.mode,
      value: safeValue,
      identityRevealed: false
    };
  }
  if (
    request.anonymitySetSize < MIN_ANONYMITY_SET_SIZE ||
    !request.privacyBudgetAvailable
  ) {
    throw new Error('L’indice agrégé risquerait de réduire excessivement l’anonymat.');
  }
  return {
    mode: request.mode,
    value: `Contexte agrégé parmi au moins ${MIN_ANONYMITY_SET_SIZE} personnes`,
    identityRevealed: false
  };
}

export function knowMeSecretPolicy() {
  return {
    schemaVersion: 1,
    separateFromMessenger: true,
    publicRoutePattern: 'knowme.app/secret/:slug',
    identityHiddenFromRecipient: true,
    premiumCanRevealIdentity: false,
    premiumCanRevealIpAddress: false,
    premiumCanRevealExactLocation: false,
    senderBlockingUsesOpaqueToken: true,
    categories: SECRET_MESSAGE_CATEGORIES,
    hintModes: SECRET_HINT_MODES,
    safety: {
      moderationBeforeDelivery: true,
      harassmentRiskFiltering: true,
      recipientBlockedTerms: true,
      senderRateLimits: true,
      captchaOrChallengeSupported: true,
      minimumAccountAgeSupported: true,
      anonymousSenderBlocking: true,
      reporting: true,
      evidenceRetentionRestrictedToSafetyOperations: true
    },
    customization: {
      avatar: true,
      background: true,
      colors: true,
      musicPremium: true,
      animationsPremium: true,
      presentation: true,
      serverAuthoritativeMessageCount: true
    },
    premium: {
      advancedThemes: true,
      aggregateStatistics: true,
      advancedSafetyFilters: true,
      privacySafeHintsOnly: true,
      identityDisclosureForbidden: true
    }
  } as const;
}
