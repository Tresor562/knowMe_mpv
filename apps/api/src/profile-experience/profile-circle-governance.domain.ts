export const PROFILE_CIRCLE_ROLES = [
  'OWNER',
  'ADMIN',
  'OFFICER',
  'MEMBER'
] as const;
export type ProfileCircleRole = (typeof PROFILE_CIRCLE_ROLES)[number];

export const PROFILE_CIRCLE_PERMISSIONS = [
  'UPDATE_APPEARANCE',
  'MANAGE_ROLES',
  'MANAGE_MEMBERS',
  'REVIEW_JOIN_REQUESTS',
  'MODERATE_CONTENT',
  'PUBLISH_PUBLIC_CONTENT',
  'MANAGE_STORIES',
  'TRANSFER_OWNERSHIP',
  'END_CIRCLE'
] as const;
export type ProfileCirclePermission =
  (typeof PROFILE_CIRCLE_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<
  ProfileCircleRole,
  Set<ProfileCirclePermission>
> = {
  OWNER: new Set(PROFILE_CIRCLE_PERMISSIONS),
  ADMIN: new Set([
    'UPDATE_APPEARANCE',
    'MANAGE_MEMBERS',
    'REVIEW_JOIN_REQUESTS',
    'MODERATE_CONTENT',
    'PUBLISH_PUBLIC_CONTENT',
    'MANAGE_STORIES'
  ]),
  OFFICER: new Set([
    'REVIEW_JOIN_REQUESTS',
    'MODERATE_CONTENT',
    'PUBLISH_PUBLIC_CONTENT',
    'MANAGE_STORIES'
  ]),
  MEMBER: new Set([])
};

export const PROFILE_FAMILY_RELATION_TYPES = [
  'PARENT',
  'CHILD',
  'SIBLING',
  'COUSIN',
  'SPOUSE',
  'GUARDIAN',
  'OTHER'
] as const;
export type ProfileFamilyRelationType =
  (typeof PROFILE_FAMILY_RELATION_TYPES)[number];

const FAMILY_INVERSE: Record<
  ProfileFamilyRelationType,
  ProfileFamilyRelationType
> = {
  PARENT: 'CHILD',
  CHILD: 'PARENT',
  SIBLING: 'SIBLING',
  COUSIN: 'COUSIN',
  SPOUSE: 'SPOUSE',
  GUARDIAN: 'OTHER',
  OTHER: 'OTHER'
};

export function roleHasCirclePermission(
  role: string,
  permission: ProfileCirclePermission
) {
  if (!PROFILE_CIRCLE_ROLES.includes(role as ProfileCircleRole)) return false;
  return ROLE_PERMISSIONS[role as ProfileCircleRole].has(permission);
}

export function validateCircleRoleChange(input: {
  actorRole: string;
  targetIsOwner: boolean;
  nextRole: string;
  circleType: string;
}) {
  if (!roleHasCirclePermission(input.actorRole, 'MANAGE_ROLES')) {
    throw new Error('Permission insuffisante pour modifier les rôles.');
  }
  if (input.targetIsOwner) {
    throw new Error('Le rôle du propriétaire change uniquement par transfert.');
  }
  if (!PROFILE_CIRCLE_ROLES.includes(input.nextRole as ProfileCircleRole)) {
    throw new Error('Rôle collectif inconnu.');
  }
  if (input.nextRole === 'OWNER') {
    throw new Error('Utilisez le transfert sécurisé de propriété.');
  }
  if (
    input.circleType.startsWith('DUO_') &&
    input.nextRole !== 'MEMBER'
  ) {
    throw new Error('Un Duo ne possède pas de hiérarchie administrative.');
  }
  return true;
}

export function validateOwnershipTransfer(input: {
  actorIsCurrentOwner: boolean;
  targetIsActiveMember: boolean;
  targetIsCurrentOwner: boolean;
  pendingTransferExists: boolean;
  expiresAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.actorIsCurrentOwner) {
    throw new Error('Seul le propriétaire actuel peut initier le transfert.');
  }
  if (!input.targetIsActiveMember || input.targetIsCurrentOwner) {
    throw new Error('Le destinataire doit être un autre membre actif.');
  }
  if (input.pendingTransferExists) {
    throw new Error('Un transfert de propriété est déjà en attente.');
  }
  if (input.expiresAt <= now) {
    throw new Error('Le transfert doit expirer dans le futur.');
  }
  if (input.expiresAt.getTime() - now.getTime() > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Un transfert ne peut pas rester ouvert plus de sept jours.');
  }
  return true;
}

export function circleStoryDurationPolicy(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new Error('Niveau collectif invalide.');
  }
  return {
    maximumHours: level === 1 ? 24 : level === 2 ? 48 : 72,
    permanentAllowed: false,
    purchasableLevelBoost: false
  } as const;
}

export function resolveCircleContentInitialStatus(input: {
  role: string;
  audience: 'PUBLIC' | 'MEMBERS';
}) {
  const canPublishPublic = roleHasCirclePermission(
    input.role,
    'PUBLISH_PUBLIC_CONTENT'
  );
  if (input.audience === 'PUBLIC' && !canPublishPublic) return 'PENDING' as const;
  return 'APPROVED' as const;
}

export function familyRelationPairKey(
  circleId: string,
  firstUserId: string,
  secondUserId: string
) {
  if (!circleId.trim() || !firstUserId.trim() || !secondUserId.trim()) {
    throw new Error('Identifiants familiaux invalides.');
  }
  if (firstUserId === secondUserId) {
    throw new Error('Une personne ne peut pas créer un lien familial avec elle-même.');
  }
  return `${circleId}:${[firstUserId, secondUserId].sort().join(':')}`;
}

export function validateFamilyRelationProposal(input: {
  circleId: string;
  circleType: string;
  proposerUserId: string;
  firstUserId: string;
  secondUserId: string;
  firstIsActiveMember: boolean;
  secondIsActiveMember: boolean;
  type: ProfileFamilyRelationType;
}) {
  if (input.circleType !== 'FAMILY') {
    throw new Error('Les liens familiaux appartiennent uniquement à un profil Famille.');
  }
  if (!input.firstIsActiveMember || !input.secondIsActiveMember) {
    throw new Error('Les deux personnes doivent être membres actifs de la Famille.');
  }
  if (
    input.proposerUserId !== input.firstUserId &&
    input.proposerUserId !== input.secondUserId
  ) {
    throw new Error('Un membre ne peut proposer qu’un lien qui le concerne.');
  }
  if (!PROFILE_FAMILY_RELATION_TYPES.includes(input.type)) {
    throw new Error('Type de lien familial inconnu.');
  }
  return {
    pairKey: familyRelationPairKey(
      input.circleId,
      input.firstUserId,
      input.secondUserId
    ),
    inverseType: FAMILY_INVERSE[input.type]
  } as const;
}

export function inverseFamilyRelationType(type: ProfileFamilyRelationType) {
  return FAMILY_INVERSE[type];
}
