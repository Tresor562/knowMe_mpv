export const MESSENGER_TABS = [
  'DISCUSSIONS',
  'FRIENDS',
  'GAMES',
  'GIFTS',
  'COMMUNITIES'
] as const;

export type MessengerTab = (typeof MESSENGER_TABS)[number];

export const MESSAGE_BUBBLE_STYLES = [
  'CLASSIC',
  'MODERN',
  'CLEAN',
  'KNOWME'
] as const;

export type MessageBubbleStyle = (typeof MESSAGE_BUBBLE_STYLES)[number];

export const MESSAGE_EFFECTS = [
  'NONE',
  'LOVE',
  'PARTY',
  'IMPORTANT_FIRE',
  'GIFT_REVEAL',
  'VICTORY'
] as const;

export type MessageEffect = (typeof MESSAGE_EFFECTS)[number];

export const ATTACHMENT_KINDS = [
  'IMAGE',
  'VIDEO',
  'VIDEO_NOTE',
  'AUDIO',
  'VOICE_NOTE',
  'DOCUMENT',
  'ARCHIVE',
  'LINK',
  'LOCATION',
  'CONTACT',
  'GIFT',
  'GAME_INVITE',
  'CHALLENGE_INVITE'
] as const;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type ConversationBackgroundSource =
  | 'SYSTEM_COLOR'
  | 'SYSTEM_GRADIENT'
  | 'SYSTEM_THEME'
  | 'USER_GALLERY'
  | 'USER_DOWNLOAD'
  | 'AI_GENERATED'
  | 'ANIMATED_CATALOG';

export type ConversationAppearance = {
  bubbleStyle: MessageBubbleStyle;
  backgroundSource: ConversationBackgroundSource;
  backgroundAssetId: string | null;
  blur: number;
  brightness: number;
  opacity: number;
  colorFilter: string | null;
  animationEnabled: boolean;
  reduceMotionOverride: boolean;
  showAvatarsBesideMessages: boolean;
};

export type VoiceMessagePreferences = {
  playbackSpeed: 0.5 | 1 | 1.5 | 2;
  transcriptionEnabled: boolean;
  translationLanguage: string | null;
  saveToConversationMedia: boolean;
};

export const CONVERSATION_TRANSLATION_MODES = [
  'OFF',
  'APP_LANGUAGE',
  'CUSTOM_LANGUAGE'
] as const;

export type ConversationTranslationMode =
  (typeof CONVERSATION_TRANSLATION_MODES)[number];

export type ConversationTranslationPreferences = {
  mode: ConversationTranslationMode;
  targetLanguage: string | null;
  showOriginalByDefault: boolean;
};

export const VOICE_TRANSFORM_SOURCES = [
  'ORIGINAL',
  'SYSTEM_PRESET',
  'USER_CONSENTED_PROFILE'
] as const;

export type VoiceTransformSource = (typeof VOICE_TRANSFORM_SOURCES)[number];

export type VoiceTransformSelection = {
  source: VoiceTransformSource;
  voiceId: string | null;
};

export type MessageDeliveryCapabilities = {
  editWindowSeconds: number;
  deleteForEveryoneWindowSeconds: number;
  reactionsEnabled: boolean;
  repliesEnabled: boolean;
  forwardingEnabled: boolean;
  scheduledMessagesEnabled: boolean;
  disappearingMessagesEnabled: boolean;
  readReceiptsConfigurable: boolean;
};

const MAX_BACKGROUND_ADJUSTMENT = 100;
const MAX_VIDEO_NOTE_DURATION_SECONDS = 60;
const MAX_DOCUMENT_BYTES_FREE = 512 * 1024 * 1024;
const MAX_DOCUMENT_BYTES_PREMIUM = 2 * 1024 * 1024 * 1024;
const STATUS_DURATION_MS = 24 * 60 * 60 * 1000;

export function validateConversationAppearance(
  appearance: ConversationAppearance,
  context: { hasPremiumEntitlement: boolean; assetModerated: boolean }
): void {
  if (!MESSAGE_BUBBLE_STYLES.includes(appearance.bubbleStyle)) {
    throw new Error('Style de bulle inconnu.');
  }
  for (const value of [appearance.blur, appearance.brightness, appearance.opacity]) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_BACKGROUND_ADJUSTMENT) {
      throw new Error('Réglage visuel invalide.');
    }
  }
  if (
    appearance.backgroundSource === 'ANIMATED_CATALOG' &&
    appearance.animationEnabled &&
    !context.hasPremiumEntitlement
  ) {
    throw new Error('Ce fond animé exige Premium.');
  }
  if (
    ['USER_GALLERY', 'USER_DOWNLOAD', 'AI_GENERATED'].includes(
      appearance.backgroundSource
    ) &&
    (!appearance.backgroundAssetId || !context.assetModerated)
  ) {
    throw new Error('Le fond personnel doit être stocké et modéré par KnowMe.');
  }
  if (appearance.reduceMotionOverride && appearance.animationEnabled) {
    throw new Error('La réduction des animations désactive le fond animé.');
  }
}

export function assertAttachmentAllowed(
  kind: AttachmentKind,
  sizeBytes: number,
  context: {
    hasPremiumEntitlement: boolean;
    malwareScanPassed: boolean;
    contentModerationPassed: boolean;
  }
): void {
  if (!ATTACHMENT_KINDS.includes(kind)) throw new Error('Type de pièce jointe inconnu.');
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error('Taille de fichier invalide.');
  }
  const limit = context.hasPremiumEntitlement
    ? MAX_DOCUMENT_BYTES_PREMIUM
    : MAX_DOCUMENT_BYTES_FREE;
  if (sizeBytes > limit) throw new Error('Fichier trop volumineux pour ce compte.');
  if (!context.malwareScanPassed) throw new Error('Le contrôle de sécurité du fichier a échoué.');
  if (!context.contentModerationPassed) throw new Error('La pièce jointe ne respecte pas les règles.');
}

export function assertMessageEffectAllowed(
  effect: MessageEffect,
  context: { reduceMotion: boolean; recipientAllowsEffects: boolean }
): MessageEffect {
  if (!MESSAGE_EFFECTS.includes(effect)) throw new Error('Effet de message inconnu.');
  if (context.reduceMotion || !context.recipientAllowsEffects) return 'NONE';
  return effect;
}

function assertLanguageTag(value: string): void {
  if (
    !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value) ||
    value.length > 35
  ) {
    throw new Error('Langue de traduction invalide.');
  }
}

export function validateConversationTranslationPreferences(
  preferences: ConversationTranslationPreferences
): void {
  if (!CONVERSATION_TRANSLATION_MODES.includes(preferences.mode)) {
    throw new Error('Mode de traduction inconnu.');
  }
  if (preferences.mode === 'OFF') {
    if (preferences.targetLanguage !== null) {
      throw new Error('La traduction désactivée ne doit pas définir de langue cible.');
    }
    return;
  }
  if (!preferences.targetLanguage) {
    throw new Error('Une langue cible est obligatoire pour traduire la conversation.');
  }
  assertLanguageTag(preferences.targetLanguage);
}

export function assertVideoNoteAllowed(
  input: {
    durationSeconds: number;
    sizeBytes: number;
  },
  context: {
    hasPremiumEntitlement: boolean;
    malwareScanPassed: boolean;
    contentModerationPassed: boolean;
  }
): void {
  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > MAX_VIDEO_NOTE_DURATION_SECONDS
  ) {
    throw new Error(
      `Une note vidéo doit durer entre 0 et ${MAX_VIDEO_NOTE_DURATION_SECONDS} secondes.`
    );
  }
  assertAttachmentAllowed('VIDEO_NOTE', input.sizeBytes, context);
}

export function assertVoiceTransformAllowed(
  selection: VoiceTransformSelection,
  context: {
    selectedVoiceExists: boolean;
    selectedVoiceOwnedByUser: boolean;
    consentVerified: boolean;
    impersonationRisk: boolean;
  }
): void {
  if (!VOICE_TRANSFORM_SOURCES.includes(selection.source)) {
    throw new Error('Source de voix inconnue.');
  }
  if (selection.source === 'ORIGINAL') {
    if (selection.voiceId !== null) {
      throw new Error('La voix originale ne doit pas référencer un profil vocal.');
    }
    return;
  }
  if (!selection.voiceId || !context.selectedVoiceExists) {
    throw new Error('Voix sélectionnée indisponible.');
  }
  if (context.impersonationRisk) {
    throw new Error('Cette transformation vocale est refusée.');
  }
  if (
    selection.source === 'USER_CONSENTED_PROFILE' &&
    (!context.selectedVoiceOwnedByUser || !context.consentVerified)
  ) {
    throw new Error('Ce profil vocal exige une propriété et un consentement vérifiés.');
  }
}

export function statusExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + STATUS_DURATION_MS);
}

export function messengerExperiencePolicy() {
  const delivery: MessageDeliveryCapabilities = {
    editWindowSeconds: 15 * 60,
    deleteForEveryoneWindowSeconds: 48 * 60 * 60,
    reactionsEnabled: true,
    repliesEnabled: true,
    forwardingEnabled: true,
    scheduledMessagesEnabled: true,
    disappearingMessagesEnabled: true,
    readReceiptsConfigurable: true
  };

  return {
    schemaVersion: 1,
    identityVisibleByDefault: true,
    anonymousMessagingIncluded: false,
    anonymousProduct: 'KNOWME_SECRET',
    tabs: MESSENGER_TABS,
    bubbleStyles: MESSAGE_BUBBLE_STYLES,
    messageEffects: MESSAGE_EFFECTS,
    attachments: ATTACHMENT_KINDS,
    delivery,
    voiceMessages: {
      variablePlaybackSpeed: true,
      transcription: true,
      translation: true,
      saving: true,
      reactions: true
    },
    videoNotes: {
      enabled: true,
      maxDurationSeconds: MAX_VIDEO_NOTE_DURATION_SECONDS,
      previewBeforeSend: true,
      frontAndRearCamera: true,
      dedicatedCompactPresentation: true
    },
    conversationTranslation: {
      enabled: true,
      wholeConversation: true,
      autoOfferWhenDetectedLanguageDiffersFromApp: true,
      appLanguageTarget: true,
      customTargetLanguage: true,
      keepsOriginalMessage: true,
      originalToggle: true,
      incomingMessagesFollowActiveTarget: true
    },
    voiceTransformation: {
      enabled: true,
      originalVoice: true,
      previewBeforeSend: true,
      systemPresetVoices: true,
      userConsentedVoiceProfiles: true,
      serverAuthoritativeVoiceCatalog: true,
      impersonationProtectionRequired: true
    },
    conversationAppearance: {
      freeColors: true,
      freeGradients: true,
      freeSimpleThemes: true,
      personalUploads: true,
      aiGeneratedBackgrounds: true,
      premiumAnimatedCatalog: true,
      blurBrightnessOpacityFilters: true,
      moderationRequired: true
    },
    avatarIntegration: {
      besideMessages: true,
      animatedReactions: true,
      contextExpressions: true,
      personalityDrivenResponses: true,
      visualOnly: true
    },
    integratedActions: {
      gifts: true,
      games: true,
      challenges: true,
      polls: true,
      location: true,
      largeFiles: true
    },
    status: {
      durationHours: 24,
      photo: true,
      video: true,
      text: true,
      music: true,
      animatedAvatar: true,
      replies: true,
      reactions: true,
      gifts: true,
      challenges: true
    },
    fileLimitsBytes: {
      free: MAX_DOCUMENT_BYTES_FREE,
      premium: MAX_DOCUMENT_BYTES_PREMIUM
    },
    encryptionRoadmap: {
      transportEncryptionRequired: true,
      encryptionAtRestRequired: true,
      endToEndForPrivateChatsPlanned: true,
      serverFeaturesMustDeclareE2ECompatibility: true
    }
  } as const;
}
