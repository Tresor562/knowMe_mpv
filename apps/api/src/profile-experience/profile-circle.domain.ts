export const PROFILE_CIRCLE_STATUS_ACTIONS = [
  'PAUSE',
  'RESUME',
  'END'
] as const;
export type ProfileCircleStatusAction =
  (typeof PROFILE_CIRCLE_STATUS_ACTIONS)[number];

export const PROFILE_CIRCLE_ACTIVITY_TYPES = [
  'CHALLENGE_WON',
  'GAME_WON',
  'MOMENT_PUBLISHED',
  'STORY_PUBLISHED',
  'EVENT_COMPLETED',
  'GIFT_RECEIVED',
  'MEMBER_CONTRIBUTION'
] as const;
export type ProfileCircleActivityType =
  (typeof PROFILE_CIRCLE_ACTIVITY_TYPES)[number];

const LEVEL_THRESHOLDS = [
  { level: 1, minimumXp: 0 },
  { level: 2, minimumXp: 5_000 },
  { level: 3, minimumXp: 20_000 },
  { level: 4, minimumXp: 80_000 },
  { level: 5, minimumXp: 250_000 }
] as const;

export function circleLevelFromXp(xp: number) {
  if (!Number.isInteger(xp) || xp < 0) {
    throw new Error('XP collective invalide.');
  }
  const current = [...LEVEL_THRESHOLDS]
    .reverse()
    .find((entry) => xp >= entry.minimumXp) ?? LEVEL_THRESHOLDS[0];
  const next = LEVEL_THRESHOLDS.find((entry) => entry.level === current.level + 1);
  return {
    level: current.level,
    xp,
    nextLevelXp: next?.minimumXp ?? null,
    remainingXp: next ? Math.max(0, next.minimumXp - xp) : 0,
    maximumLevel: 5,
    purchasable: false,
    premiumCanIncreaseLevel: false
  } as const;
}

export function transitionCircleStatus(input: {
  currentStatus: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  action: ProfileCircleStatusAction;
  actorIsOwner: boolean;
}) {
  if (!input.actorIsOwner) {
    throw new Error('Seul le propriétaire peut modifier l’état collectif.');
  }
  if (input.currentStatus === 'ENDED') {
    throw new Error('Une relation terminée ne peut pas être réactivée.');
  }
  if (input.action === 'PAUSE') {
    if (input.currentStatus !== 'ACTIVE') {
      throw new Error('Seule une relation active peut être mise en pause.');
    }
    return 'PAUSED' as const;
  }
  if (input.action === 'RESUME') {
    if (input.currentStatus !== 'PAUSED') {
      throw new Error('Seule une relation en pause peut être reprise.');
    }
    return 'ACTIVE' as const;
  }
  return 'ENDED' as const;
}

export function canViewProfileCircle(input: {
  visibility:
    | 'PUBLIC'
    | 'FRIENDS'
    | 'FOLLOWERS'
    | 'BEST_FRIENDS'
    | 'DUO'
    | 'TEAM'
    | 'FAMILY'
    | 'GUILD'
    | 'COMMUNITIES'
    | 'PRIVATE';
  viewerIsMember: boolean;
  viewerIsFriendOfOwner: boolean;
  viewerIsFollowerOfOwner: boolean;
}) {
  if (input.viewerIsMember) return { visible: true, reason: 'MEMBER' } as const;
  if (input.visibility === 'PUBLIC') {
    return { visible: true, reason: 'PUBLIC' } as const;
  }
  if (input.visibility === 'FRIENDS' && input.viewerIsFriendOfOwner) {
    return { visible: true, reason: 'FRIEND_OF_OWNER' } as const;
  }
  if (input.visibility === 'FOLLOWERS' && input.viewerIsFollowerOfOwner) {
    return { visible: true, reason: 'FOLLOWER_OF_OWNER' } as const;
  }
  return { visible: false, reason: 'AUDIENCE_DENIED' } as const;
}

export function validateCircleJoinRequest(input: {
  type: string;
  status: string;
  joinable: boolean;
  memberCount: number;
  maximumMembers: number;
  alreadyMember: boolean;
}) {
  if (input.type !== 'GUILD') {
    throw new Error('Seules les guildes acceptent les demandes d’adhésion.');
  }
  if (input.status !== 'ACTIVE') {
    throw new Error('La guilde doit être active.');
  }
  if (!input.joinable) {
    throw new Error('Cette guilde n’accepte pas de nouvelles demandes.');
  }
  if (input.alreadyMember) {
    throw new Error('Ce profil appartient déjà à cette guilde.');
  }
  if (input.memberCount >= input.maximumMembers) {
    throw new Error('La guilde a atteint sa capacité maximale.');
  }
  return true;
}

export function validateCircleActivity(input: {
  type: ProfileCircleActivityType;
  xpAwarded: number;
  idempotencyKey: string;
}) {
  if (!PROFILE_CIRCLE_ACTIVITY_TYPES.includes(input.type)) {
    throw new Error('Type d’activité collective inconnu.');
  }
  if (!Number.isInteger(input.xpAwarded) || input.xpAwarded < 0 || input.xpAwarded > 10_000) {
    throw new Error('Gain d’XP collective invalide.');
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 180) {
    throw new Error('Clé d’idempotence collective invalide.');
  }
  return true;
}
