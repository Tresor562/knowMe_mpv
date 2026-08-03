export const PROFILE_SECTIONS = [
  'HEADER',
  'BIO',
  'PUBLIC_BADGES',
  'ACTIONS',
  'STATISTICS',
  'COLLECTIONS',
  'GIFTS',
  'WALL',
  'TIMELINE',
  'CHALLENGES',
  'GAMES',
  'FRIENDS',
  'FOLLOWERS',
  'CIRCLES',
  'INTERESTS',
  'COMPATIBILITY',
  'INFLUENCER_ANALYTICS'
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const PROFILE_AUDIENCES = [
  'PUBLIC',
  'FRIENDS',
  'FOLLOWERS',
  'BEST_FRIENDS',
  'DUO',
  'TEAM',
  'FAMILY',
  'GUILD',
  'COMMUNITIES',
  'PRIVATE'
] as const;
export type ProfileAudience = (typeof PROFILE_AUDIENCES)[number];

export const PROFILE_VIEWER_RELATIONS = [
  'OWNER',
  'DUO',
  'BEST_FRIEND',
  'FAMILY',
  'TEAM_MEMBER',
  'GUILD_MEMBER',
  'FRIEND',
  'FOLLOWER',
  'COMMUNITY_MEMBER',
  'PUBLIC'
] as const;
export type ProfileViewerRelation = (typeof PROFILE_VIEWER_RELATIONS)[number];

export const PROFILE_GUARD_SCOPES = [
  'PROFILE',
  'PRIVATE_MESSAGES',
  'SECRET_MESSAGES',
  'VIEW_ONCE_MEDIA',
  'RARE_GIFTS',
  'SECRET_CONVERSATIONS',
  'PAYMENTS',
  'ADMIN',
  'SENSITIVE_DOCUMENTS'
] as const;
export type ProfileGuardScope = (typeof PROFILE_GUARD_SCOPES)[number];

export const PROFILE_CIRCLE_TYPES = [
  'DUO_COUPLE',
  'DUO_BEST_FRIENDS',
  'DUO_SIBLINGS',
  'DUO_GAMING',
  'DUO_CREATIVE',
  'TEAM',
  'FAMILY',
  'GUILD'
] as const;
export type ProfileCircleType = (typeof PROFILE_CIRCLE_TYPES)[number];

export type ProfileSectionRule = {
  section: ProfileSection;
  audience: ProfileAudience;
  allowedWhenLocked: boolean;
};

const LOCKED_PROFILE_BASELINE = new Set<ProfileSection>([
  'HEADER',
  'BIO',
  'PUBLIC_BADGES',
  'ACTIONS'
]);

const SECURITY_BASELINE_SCOPES = new Set<ProfileGuardScope>([
  'VIEW_ONCE_MEDIA',
  'PAYMENTS',
  'ADMIN',
  'SENSITIVE_DOCUMENTS'
]);

const RELATION_AUDIENCES: Record<ProfileViewerRelation, Set<ProfileAudience>> = {
  OWNER: new Set(PROFILE_AUDIENCES),
  DUO: new Set(['PUBLIC', 'FOLLOWERS', 'FRIENDS', 'BEST_FRIENDS', 'DUO']),
  BEST_FRIEND: new Set(['PUBLIC', 'FOLLOWERS', 'FRIENDS', 'BEST_FRIENDS']),
  FAMILY: new Set(['PUBLIC', 'FOLLOWERS', 'FRIENDS', 'FAMILY']),
  TEAM_MEMBER: new Set(['PUBLIC', 'FOLLOWERS', 'FRIENDS', 'TEAM']),
  GUILD_MEMBER: new Set(['PUBLIC', 'FOLLOWERS', 'FRIENDS', 'GUILD']),
  FRIEND: new Set(['PUBLIC', 'FOLLOWERS', 'FRIENDS']),
  FOLLOWER: new Set(['PUBLIC', 'FOLLOWERS']),
  COMMUNITY_MEMBER: new Set(['PUBLIC', 'COMMUNITIES']),
  PUBLIC: new Set(['PUBLIC'])
};

export function defaultProfileSectionRules(): ProfileSectionRule[] {
  return PROFILE_SECTIONS.map((section) => ({
    section,
    audience: LOCKED_PROFILE_BASELINE.has(section) ? 'PUBLIC' : 'FRIENDS',
    allowedWhenLocked: LOCKED_PROFILE_BASELINE.has(section)
  }));
}

export function resolveProfileSectionAccess(input: {
  section: ProfileSection;
  audience: ProfileAudience;
  allowedWhenLocked: boolean;
  profileLocked: boolean;
  viewerRelation: ProfileViewerRelation;
}): { visible: boolean; reason: string } {
  if (input.viewerRelation === 'OWNER') {
    return { visible: true, reason: 'OWNER' };
  }

  if (
    input.profileLocked &&
    !LOCKED_PROFILE_BASELINE.has(input.section) &&
    !input.allowedWhenLocked
  ) {
    return { visible: false, reason: 'PROFILE_LOCKED' };
  }

  const visible = RELATION_AUDIENCES[input.viewerRelation].has(input.audience);
  return {
    visible,
    reason: visible ? `AUDIENCE_${input.audience}` : `AUDIENCE_DENIED_${input.audience}`
  };
}

export function circleLimits(type: ProfileCircleType) {
  const duo = type.startsWith('DUO_');
  return {
    minimumMembers: duo ? 2 : type === 'TEAM' ? 2 : 2,
    maximumMembers: duo ? 2 : type === 'TEAM' ? 7 : type === 'FAMILY' ? 50 : 500,
    requiresUnanimousConsent: duo || type === 'TEAM' || type === 'FAMILY',
    joinable: type === 'GUILD',
    sharedCoverSupported: true,
    sharedBioSupported: true,
    collectiveProgressionSupported: !duo || type === 'DUO_GAMING' || type === 'DUO_CREATIVE'
  } as const;
}

export function validateProfileCircle(input: {
  type: ProfileCircleType;
  memberCount: number;
  activeConsents: number;
  level: number;
  xp: number;
}) {
  if (!PROFILE_CIRCLE_TYPES.includes(input.type)) throw new Error('Type de relation inconnu.');
  const limits = circleLimits(input.type);
  if (!Number.isInteger(input.memberCount) || input.memberCount < limits.minimumMembers) {
    throw new Error(`Cette relation exige au moins ${limits.minimumMembers} membres.`);
  }
  if (input.memberCount > limits.maximumMembers) {
    throw new Error(`Cette relation accepte au maximum ${limits.maximumMembers} membres.`);
  }
  if (limits.requiresUnanimousConsent && input.activeConsents !== input.memberCount) {
    throw new Error('Tous les membres doivent accepter explicitement cette relation.');
  }
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5) {
    throw new Error('Niveau collectif invalide.');
  }
  if (!Number.isInteger(input.xp) || input.xp < 0) throw new Error('XP collective invalide.');
  return limits;
}

export function profileEvolutionTier(level: number) {
  if (!Number.isInteger(level) || level < 1) throw new Error('Niveau de profil invalide.');
  const tier = Math.min(5, Math.max(1, Math.ceil(level / 20)));
  const unlocks: Record<number, string[]> = {
    1: ['HEADER_THEME', 'BADGE_SHOWCASE'],
    2: ['SECOND_SHOWCASE', 'SOFT_ENTRY_ANIMATIONS'],
    3: ['TIMELINE_LAYOUTS', 'ADVANCED_FRAMES'],
    4: ['LIVING_COVER', 'COLLECTION_ROOMS'],
    5: ['LEGENDARY_PROFILE_SCENE', 'SIGNATURE_TRANSITIONS']
  };
  return {
    tier,
    unlocks: unlocks[tier],
    purchasable: false,
    premiumCanIncreaseTier: false
  } as const;
}

export function resolveGuardScopes(input: {
  enabled: boolean;
  requestedScopes: ProfileGuardScope[];
  hasPremiumEntitlement: boolean;
}) {
  const invalid = input.requestedScopes.filter((scope) => !PROFILE_GUARD_SCOPES.includes(scope));
  if (invalid.length) throw new Error(`Portée Guard inconnue : ${invalid.join(', ')}`);

  const scopes = new Set<ProfileGuardScope>(SECURITY_BASELINE_SCOPES);
  if (input.enabled) scopes.add('PROFILE');

  if (input.hasPremiumEntitlement) {
    for (const scope of input.requestedScopes) scopes.add(scope);
  } else if (input.requestedScopes.some((scope) => !scopes.has(scope) && scope !== 'PROFILE')) {
    throw new Error('Le réglage détaillé des zones Guard exige Premium.');
  }

  return {
    scopes: [...scopes],
    granularControl: input.hasPremiumEntitlement,
    baselineSecurityNeverPaywalled: true
  } as const;
}

export function profileGuardPlatformPolicy(platform: 'ANDROID' | 'IOS' | 'WEB' | 'DESKTOP') {
  if (platform === 'ANDROID') {
    return {
      mode: 'NATIVE_MAXIMUM',
      screenshotBlocking: true,
      screenRecordingBlocking: true,
      nonSecureDisplayBlocking: true,
      screenshotDetection: 'ANDROID_14_CALLBACK_WHEN_AVAILABLE',
      implementation: 'FLAG_SECURE',
      absoluteGuarantee: false,
      disclosure: 'Protection maximale fournie par Android, avec variations possibles selon version et fabricant.'
    } as const;
  }
  if (platform === 'IOS') {
    return {
      mode: 'BEST_AVAILABLE',
      screenshotBlocking: false,
      screenRecordingBlocking: false,
      activeCaptureDetection: true,
      activeCaptureMasking: true,
      screenshotDetection: 'AFTER_CAPTURE_NOTIFICATION',
      implementation: 'SCENE_CAPTURE_STATE_AND_SCREENSHOT_NOTIFICATION',
      absoluteGuarantee: false,
      disclosure: 'iOS ne fournit pas de blocage général garanti des captures ; KnowMe masque lorsque la capture active est détectable et signale les captures après coup.'
    } as const;
  }
  return {
    mode: 'DETERRENCE_ONLY',
    screenshotBlocking: false,
    screenRecordingBlocking: false,
    activeCaptureDetection: false,
    watermarking: true,
    warnViewer: true,
    absoluteGuarantee: false,
    disclosure: 'Le Web et le bureau ne peuvent pas empêcher de manière fiable une capture externe.'
  } as const;
}

export function canNotifyCaptureOwner(input: {
  notifyOwnerEnabled: boolean;
  nativeSignal: boolean;
  attestationValid: boolean;
  eventType: string;
}) {
  const supported = new Set([
    'SCREENSHOT_COMPLETED',
    'SCREEN_RECORDING_STARTED',
    'SCREEN_MIRRORING_STARTED',
    'SECURE_SURFACE_BLOCKED'
  ]);
  return (
    input.notifyOwnerEnabled &&
    input.nativeSignal &&
    input.attestationValid &&
    supported.has(input.eventType)
  );
}

export function compatibilityPrivacyPolicy() {
  return {
    requiresAuthenticatedViewer: true,
    viewerMustBeParticipant: true,
    categories: ['LOVE', 'FRIENDSHIP', 'GAMING', 'STUDIES', 'MUSIC', 'ANIME', 'TRAVEL'],
    exactPrivateSignalsExposed: false,
    privateMessagesQuoted: false,
    privateInterestsExposed: false,
    explanationUsesAggregatedReasons: true,
    minimumSignalThreshold: true,
    ownerCanHideSection: true
  } as const;
}

export function conceptKProfilePolicy() {
  return {
    schemaVersion: 1,
    philosophy: 'Le profil raconte une histoire sans sacrifier la confidentialité.',
    sections: PROFILE_SECTIONS,
    audiences: PROFILE_AUDIENCES,
    circleTypes: PROFILE_CIRCLE_TYPES,
    guardScopes: PROFILE_GUARD_SCOPES,
    lockedProfile: {
      serverEnforced: true,
      defaultVisibleSections: [...LOCKED_PROFILE_BASELINE],
      perSectionOverrideSupported: true,
      automaticUnlockAfterAcceptedFriendship: true
    },
    memories: {
      timelineAudienceControlled: true,
      vaultPrivateByDefault: true,
      oldUsernamesNeverPublicByDefault: true
    },
    premium: {
      profileSecurityBaselinePaywalled: false,
      granularGuardScopes: true,
      decorativeGuardStyles: true,
      animatedAvatar: true,
      levelPurchasable: false
    },
    compatibility: compatibilityPrivacyPolicy()
  } as const;
}
