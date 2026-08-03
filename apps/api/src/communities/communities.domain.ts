export const COMMUNITY_ENTITY_TYPES = ['GROUP', 'CHANNEL'] as const;
export type CommunityEntityType = (typeof COMMUNITY_ENTITY_TYPES)[number];

export const COMMUNITY_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type CommunityVisibility = (typeof COMMUNITY_VISIBILITIES)[number];

export const COMMUNITY_ROLES = [
  'OWNER',
  'ADMIN',
  'MODERATOR',
  'MEMBER',
  'SUBSCRIBER'
] as const;
export type CommunityRole = (typeof COMMUNITY_ROLES)[number];

export const COMMUNITY_PERMISSIONS = [
  'VIEW',
  'SEND_MESSAGES',
  'PUBLISH_POSTS',
  'COMMENT_POSTS',
  'PUBLISH_STORIES',
  'CREATE_POLLS',
  'CREATE_QUIZZES',
  'START_GAMES',
  'CREATE_CHALLENGES',
  'SEND_GIFTS',
  'CREATE_EVENTS',
  'MANAGE_EVENTS',
  'PIN_CONTENT',
  'DELETE_MESSAGES',
  'DELETE_POSTS',
  'MANAGE_MEMBERS',
  'APPROVE_MEMBERS',
  'BAN_MEMBERS',
  'MANAGE_ROLES',
  'MANAGE_BOTS',
  'MANAGE_APPEARANCE',
  'MANAGE_INVITE_LINKS',
  'VIEW_ANALYTICS',
  'MANAGE_MONETIZATION',
  'TRANSFER_OWNERSHIP'
] as const;
export type CommunityPermission = (typeof COMMUNITY_PERMISSIONS)[number];

export type CommunityInviteMode = 'PERMANENT' | 'TEMPORARY' | 'APPROVAL';

export type CommunityInvitePolicy = {
  mode: CommunityInviteMode;
  expiresAt: Date | null;
  maximumUses: number | null;
  requiresApproval: boolean;
};

export type CommunityProgressionMetrics = {
  entityType: CommunityEntityType;
  ageDays: number;
  totalParticipants: number;
  activeParticipants30d: number;
  uniqueActiveDays30d: number;
  messages30d: number;
  publications30d: number;
  reactions30d: number;
  stories30d: number;
  completedChallenges30d: number;
  gifts30d: number;
  events90d: number;
  retentionBps: number;
  contentQualityScore: number;
  unresolvedReports90d: number;
  confirmedViolations90d: number;
  repeatedContentRatioBps: number;
  historicalXp: number;
};

export type CommunityLevel = 1 | 2 | 3 | 4 | 5;

export type CommunityProgressionResult = {
  level: CommunityLevel;
  xp: number;
  xpEarnedFromWindow: number;
  nextLevelXp: number | null;
  eligibleForNextLevel: boolean;
  missingRequirements: string[];
  reputationScore: number;
  spamPenaltyXp: number;
  moderationPenaltyXp: number;
};

export type CommunityStoryDuration =
  | 1
  | 6
  | 12
  | 24
  | 48
  | 72
  | 168
  | 336
  | 720
  | 'PERMANENT';

export type CommunityStoryContext = {
  level: CommunityLevel;
  hasPremiumEntitlement: boolean;
  canPublishStories: boolean;
  scheduled: boolean;
  restrictedAudience: boolean;
};

const LEVEL_XP: Record<CommunityLevel, number> = {
  1: 0,
  2: 5_000,
  3: 20_000,
  4: 80_000,
  5: 250_000
};

const GROUP_PARTICIPANT_CAPS: Record<CommunityLevel, number> = {
  1: 100,
  2: 500,
  3: 5_000,
  4: 50_000,
  5: 500_000
};

const CHANNEL_SUBSCRIBER_CAPS: Record<CommunityLevel, number | null> = {
  1: 1_000,
  2: 10_000,
  3: 100_000,
  4: 1_000_000,
  5: null
};

const FREE_STORY_HOURS = [1, 6, 12, 24, 48, 72] as const;
const PREMIUM_STORY_HOURS = [168, 336, 720] as const;

const GROUP_UNLOCKS: Record<CommunityLevel, string[]> = {
  1: ['GROUP_CHAT', 'INVITE_LINK', 'GROUP_PHOTO', 'STORIES_24H'],
  2: ['STORIES_48H', 'ADVANCED_REACTIONS', 'POLLS', 'MINI_GAMES'],
  3: [
    'STORIES_72H',
    'CUSTOM_THEME',
    'ANIMATED_GROUP_AVATAR',
    'EVENTS',
    'MEMBER_BADGES',
    'QUIZZES'
  ],
  4: [
    'ADVANCED_ANALYTICS',
    'FULL_CUSTOMIZATION',
    'EVENT_ROOM',
    'EXCLUSIVE_GROUP_GIFTS',
    'VERIFICATION_ELIGIBILITY',
    'MEMBER_LEADERBOARD'
  ],
  5: [
    'LEGENDARY_BADGE',
    'SPECIAL_PUBLIC_PROFILE',
    'UNIQUE_ANIMATIONS',
    'GROUP_STORE',
    'PROFESSIONAL_ANALYTICS',
    'PARTNERSHIP_ELIGIBILITY'
  ]
};

const CHANNEL_UNLOCKS: Record<CommunityLevel, string[]> = {
  1: ['PUBLICATIONS', 'PUBLIC_LINK', 'LOGO', 'DESCRIPTION', 'STORIES_24H'],
  2: ['POLLS', 'SIMPLE_ANALYTICS', 'STORIES_48H', 'SCHEDULED_POSTS'],
  3: [
    'COMMENTS',
    'CUSTOM_THEME',
    'SUBSCRIBER_BADGES',
    'STORIES_72H',
    'SPECIAL_REACTIONS'
  ],
  4: [
    'TEMPORARY_OFFICIAL_BADGE',
    'ADVANCED_ANALYTICS',
    'LIVE_EVENTS',
    'ADVANCED_CUSTOMIZATION',
    'MONETIZATION_REVIEW'
  ],
  5: [
    'LEGENDARY_VERIFICATION',
    'TOTAL_CUSTOMIZATION',
    'ADVANCED_CREATOR_TOOLS',
    'KNOWCOIN_REVENUE',
    'EXCLUSIVE_GIFTS',
    'EDITORIAL_FEATURE_ELIGIBILITY'
  ]
};

const ROLE_PERMISSIONS: Record<CommunityRole, CommunityPermission[]> = {
  OWNER: [...COMMUNITY_PERMISSIONS],
  ADMIN: COMMUNITY_PERMISSIONS.filter(
    (permission) => permission !== 'TRANSFER_OWNERSHIP'
  ),
  MODERATOR: [
    'VIEW',
    'SEND_MESSAGES',
    'PUBLISH_POSTS',
    'COMMENT_POSTS',
    'PUBLISH_STORIES',
    'CREATE_POLLS',
    'CREATE_QUIZZES',
    'START_GAMES',
    'CREATE_CHALLENGES',
    'SEND_GIFTS',
    'PIN_CONTENT',
    'DELETE_MESSAGES',
    'DELETE_POSTS',
    'APPROVE_MEMBERS',
    'BAN_MEMBERS'
  ],
  MEMBER: [
    'VIEW',
    'SEND_MESSAGES',
    'COMMENT_POSTS',
    'PUBLISH_STORIES',
    'CREATE_POLLS',
    'CREATE_QUIZZES',
    'START_GAMES',
    'CREATE_CHALLENGES',
    'SEND_GIFTS'
  ],
  SUBSCRIBER: ['VIEW', 'COMMENT_POSTS', 'SEND_GIFTS']
};

function assertIntegerRange(
  value: number,
  minimum: number,
  maximum: number,
  name: string
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} invalide.`);
  }
}

export function validateProgressionMetrics(metrics: CommunityProgressionMetrics): void {
  if (!COMMUNITY_ENTITY_TYPES.includes(metrics.entityType)) {
    throw new Error('Type de communauté inconnu.');
  }
  for (const [name, value] of Object.entries({
    ageDays: metrics.ageDays,
    totalParticipants: metrics.totalParticipants,
    activeParticipants30d: metrics.activeParticipants30d,
    uniqueActiveDays30d: metrics.uniqueActiveDays30d,
    messages30d: metrics.messages30d,
    publications30d: metrics.publications30d,
    reactions30d: metrics.reactions30d,
    stories30d: metrics.stories30d,
    completedChallenges30d: metrics.completedChallenges30d,
    gifts30d: metrics.gifts30d,
    events90d: metrics.events90d,
    unresolvedReports90d: metrics.unresolvedReports90d,
    confirmedViolations90d: metrics.confirmedViolations90d,
    historicalXp: metrics.historicalXp
  })) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} invalide.`);
  }
  assertIntegerRange(metrics.retentionBps, 0, 10_000, 'Rétention');
  assertIntegerRange(metrics.contentQualityScore, 0, 100, 'Qualité du contenu');
  assertIntegerRange(metrics.repeatedContentRatioBps, 0, 10_000, 'Ratio répétitif');
  if (metrics.activeParticipants30d > metrics.totalParticipants) {
    throw new Error('Les participants actifs dépassent le total.');
  }
  if (metrics.uniqueActiveDays30d > 30) {
    throw new Error('Nombre de jours actifs invalide.');
  }
}

export function calculateCommunityProgression(
  metrics: CommunityProgressionMetrics
): CommunityProgressionResult {
  validateProgressionMetrics(metrics);

  const messageXp = Math.min(metrics.messages30d, 20_000);
  const publicationXp = Math.min(metrics.publications30d * 8, 20_000);
  const reactionXp = Math.min(Math.floor(metrics.reactions30d / 3), 12_000);
  const storyXp = Math.min(metrics.stories30d * 5, 3_000);
  const challengeXp = Math.min(metrics.completedChallenges30d * 10, 5_000);
  const giftXp = Math.min(metrics.gifts30d * 15, 5_000);
  const eventXp = Math.min(metrics.events90d * 50, 5_000);
  const activeMemberXp = Math.min(metrics.activeParticipants30d * 20, 30_000);
  const activeDayXp = metrics.uniqueActiveDays30d * 100;
  const retentionXp = Math.round(metrics.retentionBps / 10);
  const qualityXp = metrics.contentQualityScore * 50;

  const repeatedAboveTolerance = Math.max(0, metrics.repeatedContentRatioBps - 1_500);
  const spamPenaltyXp = Math.min(
    40_000,
    Math.round((repeatedAboveTolerance / 10_000) * (messageXp + publicationXp) * 4)
  );
  const moderationPenaltyXp = Math.min(
    80_000,
    metrics.unresolvedReports90d * 100 + metrics.confirmedViolations90d * 5_000
  );

  const rawWindowXp =
    messageXp +
    publicationXp +
    reactionXp +
    storyXp +
    challengeXp +
    giftXp +
    eventXp +
    activeMemberXp +
    activeDayXp +
    retentionXp +
    qualityXp;
  const xpEarnedFromWindow = Math.max(
    0,
    rawWindowXp - spamPenaltyXp - moderationPenaltyXp
  );
  const xp = Math.max(0, metrics.historicalXp + xpEarnedFromWindow);
  const reputationScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        metrics.contentQualityScore * 0.55 +
          (metrics.retentionBps / 100) * 0.35 +
          Math.min(metrics.uniqueActiveDays30d, 30) * 0.33 -
          metrics.confirmedViolations90d * 8 -
          metrics.unresolvedReports90d * 0.25
      )
    )
  );

  let level: CommunityLevel = 1;
  for (const candidate of [2, 3, 4, 5] as CommunityLevel[]) {
    if (meetsLevelRequirements(candidate, metrics, xp, reputationScore).length === 0) {
      level = candidate;
    }
  }

  const nextLevel = level < 5 ? ((level + 1) as CommunityLevel) : null;
  const missingRequirements = nextLevel
    ? meetsLevelRequirements(nextLevel, metrics, xp, reputationScore)
    : [];

  return {
    level,
    xp,
    xpEarnedFromWindow,
    nextLevelXp: nextLevel ? LEVEL_XP[nextLevel] : null,
    eligibleForNextLevel: Boolean(nextLevel && missingRequirements.length === 0),
    missingRequirements,
    reputationScore,
    spamPenaltyXp,
    moderationPenaltyXp
  };
}

export function meetsLevelRequirements(
  level: CommunityLevel,
  metrics: CommunityProgressionMetrics,
  xp: number,
  reputationScore: number
): string[] {
  const missing: string[] = [];
  const activeRequirement =
    metrics.entityType === 'CHANNEL'
      ? ({ 1: 5, 2: 100, 3: 1_000, 4: 10_000, 5: 50_000 } as const)[level]
      : ({ 1: 5, 2: 50, 3: 200, 4: 1_000, 5: 5_000 } as const)[level];
  const ageRequirement = ({ 1: 0, 2: 30, 3: 90, 4: 180, 5: 365 } as const)[level];
  const reputationRequirement = ({ 1: 0, 2: 55, 3: 75, 4: 85, 5: 92 } as const)[level];
  const activeDaysRequirement = ({ 1: 1, 2: 10, 3: 20, 4: 25, 5: 28 } as const)[level];

  if (xp < LEVEL_XP[level]) missing.push(`XP_${LEVEL_XP[level]}`);
  if (metrics.ageDays < ageRequirement) missing.push(`AGE_DAYS_${ageRequirement}`);
  if (metrics.activeParticipants30d < activeRequirement) {
    missing.push(`ACTIVE_PARTICIPANTS_${activeRequirement}`);
  }
  if (metrics.uniqueActiveDays30d < activeDaysRequirement) {
    missing.push(`ACTIVE_DAYS_${activeDaysRequirement}`);
  }
  if (reputationScore < reputationRequirement) {
    missing.push(`REPUTATION_${reputationRequirement}`);
  }
  if (level >= 3 && metrics.confirmedViolations90d > 2) {
    missing.push('TOO_MANY_CONFIRMED_VIOLATIONS');
  }
  if (level >= 4 && metrics.repeatedContentRatioBps > 2_500) {
    missing.push('REPEATED_CONTENT_TOO_HIGH');
  }
  return missing;
}

export function assertCommunityStoryDurationAllowed(
  duration: CommunityStoryDuration,
  context: CommunityStoryContext
): void {
  if (!context.canPublishStories) throw new Error('Permission Story manquante.');

  const freeMaximum = context.level === 1 ? 24 : context.level === 2 ? 48 : 72;
  if (typeof duration === 'number' && FREE_STORY_HOURS.includes(duration as never)) {
    if (duration > freeMaximum) {
      throw new Error('Cette durée de Story exige un niveau supérieur.');
    }
  } else if (
    typeof duration === 'number' &&
    PREMIUM_STORY_HOURS.includes(duration as never)
  ) {
    if (!context.hasPremiumEntitlement) throw new Error('Cette durée exige Premium.');
    if (context.level < 2) throw new Error('Le niveau 2 est requis pour les Stories longues.');
  } else if (duration === 'PERMANENT') {
    if (!context.hasPremiumEntitlement || context.level < 4) {
      throw new Error('Une Story permanente exige Premium et le niveau 4.');
    }
  } else {
    throw new Error('Durée de Story inconnue.');
  }

  if (context.scheduled && !context.hasPremiumEntitlement) {
    throw new Error('La programmation de Story exige Premium.');
  }
  if (context.restrictedAudience && !context.hasPremiumEntitlement) {
    throw new Error('Les Stories ciblées exigent Premium.');
  }
}

export function validateInvitePolicy(
  policy: CommunityInvitePolicy,
  now = new Date()
): void {
  if (policy.mode === 'PERMANENT') {
    if (policy.expiresAt || policy.maximumUses) {
      throw new Error('Un lien permanent ne possède ni expiration ni limite.');
    }
    if (policy.requiresApproval) {
      throw new Error('Utiliser le mode APPROVAL pour une validation obligatoire.');
    }
    return;
  }
  if (policy.mode === 'APPROVAL') {
    if (!policy.requiresApproval) throw new Error('La validation doit être activée.');
    return;
  }
  if (policy.mode !== 'TEMPORARY') throw new Error('Mode de lien inconnu.');
  if (!policy.expiresAt && !policy.maximumUses) {
    throw new Error('Un lien temporaire exige une expiration ou une limite.');
  }
  if (policy.expiresAt) {
    const maximumExpiry = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    if (policy.expiresAt.getTime() <= now.getTime()) throw new Error('Lien déjà expiré.');
    if (policy.expiresAt.getTime() > maximumExpiry) {
      throw new Error('Un lien temporaire ne peut dépasser 30 jours.');
    }
  }
  if (
    policy.maximumUses !== null &&
    (!Number.isInteger(policy.maximumUses) ||
      policy.maximumUses < 1 ||
      policy.maximumUses > 100_000)
  ) {
    throw new Error('Limite d’utilisation invalide.');
  }
}

export function permissionsForRole(
  entityType: CommunityEntityType,
  role: CommunityRole
): CommunityPermission[] {
  if (!COMMUNITY_ENTITY_TYPES.includes(entityType)) throw new Error('Type inconnu.');
  if (!COMMUNITY_ROLES.includes(role)) throw new Error('Rôle inconnu.');
  if (entityType === 'CHANNEL' && role === 'MEMBER') {
    return ROLE_PERMISSIONS.SUBSCRIBER;
  }
  if (entityType === 'GROUP' && role === 'SUBSCRIBER') {
    return ROLE_PERMISSIONS.MEMBER;
  }
  return [...ROLE_PERMISSIONS[role]];
}

export function communityUnlocks(
  entityType: CommunityEntityType,
  level: CommunityLevel
): string[] {
  const source = entityType === 'GROUP' ? GROUP_UNLOCKS : CHANNEL_UNLOCKS;
  return ([1, 2, 3, 4, 5] as CommunityLevel[])
    .filter((candidate) => candidate <= level)
    .flatMap((candidate) => source[candidate]);
}

export function participantCap(
  entityType: CommunityEntityType,
  level: CommunityLevel
): number | null {
  return entityType === 'GROUP'
    ? GROUP_PARTICIPANT_CAPS[level]
    : CHANNEL_SUBSCRIBER_CAPS[level];
}

export function communitiesPolicy() {
  return {
    schemaVersion: 1,
    entityTypes: COMMUNITY_ENTITY_TYPES,
    visibility: COMMUNITY_VISIBILITIES,
    roles: COMMUNITY_ROLES,
    permissions: COMMUNITY_PERMISSIONS,
    maximumLevel: 5,
    levelPurchasable: false,
    premiumChangesLevel: false,
    hiddenXpBackedByServerMetrics: true,
    xpVisibleToManagers: true,
    antiSpam: {
      repeatedContentPenalty: true,
      messageContributionCapped: true,
      inactiveMembersWeightedDown: true,
      confirmedViolationsBlockPrestigeLevels: true,
      purchasedMembersForbidden: true,
      suspiciousGrowthReview: true
    },
    groups: {
      memberParticipation: true,
      publicAndPrivate: true,
      invitationLinks: true,
      approvalFlow: true,
      stories: true,
      polls: true,
      quizzes: true,
      games: true,
      challenges: true,
      gifts: true,
      events: true,
      bots: true,
      rolesAndPermissions: true,
      progression: true
    },
    channels: {
      adminPublishingByDefault: true,
      subscriberFollowing: true,
      commentsConfigurable: true,
      reactions: true,
      polls: true,
      games: true,
      gifts: true,
      files: true,
      stories: true,
      analytics: true,
      monetizationReview: true,
      progression: true
    },
    stories: {
      freeHours: FREE_STORY_HOURS,
      premiumHours: PREMIUM_STORY_HOURS,
      permanentRequiresPremiumAndLevel4: true,
      schedulingPremium: true,
      restrictedAudiencePremium: true
    },
    links: {
      canonicalGroupPattern: 'knowme.app/group/:slug',
      shortGroupPattern: 'km.me/g/:token',
      canonicalChannelPattern: 'knowme.app/channel/:slug',
      shortChannelPattern: 'km.me/c/:token',
      permanent: true,
      temporary: true,
      approval: true
    },
    verification: {
      automaticAtLevel5: false,
      eligibilityFromProgression: true,
      independentIdentityAndSafetyReview: true,
      revocable: true
    }
  } as const;
}
