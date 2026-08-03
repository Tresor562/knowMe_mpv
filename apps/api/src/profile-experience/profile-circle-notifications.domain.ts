export const PROFILE_CIRCLE_NOTIFICATION_TYPES = [
  'CIRCLE_INVITATION',
  'CIRCLE_INVITATION_ACCEPTED',
  'CIRCLE_INVITATION_DECLINED',
  'CIRCLE_MEMBER_LEFT',
  'CIRCLE_MEMBER_REMOVED',
  'CIRCLE_JOIN_REQUESTED',
  'CIRCLE_JOIN_APPROVED',
  'CIRCLE_JOIN_DECLINED',
  'CIRCLE_LIFECYCLE_CHANGED',
  'CIRCLE_ROLE_CHANGED',
  'CIRCLE_TRANSFER_CREATED',
  'CIRCLE_TRANSFER_ACCEPTED',
  'CIRCLE_TRANSFER_CANCELLED',
  'CIRCLE_CONTENT_APPROVED',
  'CIRCLE_CONTENT_HIDDEN',
  'CIRCLE_CONTENT_REMOVED',
  'FAMILY_RELATION_PROPOSED',
  'FAMILY_RELATION_ACCEPTED',
  'FAMILY_RELATION_DECLINED',
  'FAMILY_RELATION_REMOVED'
] as const;

export type ProfileCircleNotificationType =
  (typeof PROFILE_CIRCLE_NOTIFICATION_TYPES)[number];

export function normalizeNotificationRecipients(input: {
  recipients: string[];
  actorUserId?: string | null;
  includeActor?: boolean;
}) {
  return [...new Set(input.recipients.map((value) => value.trim()))]
    .filter(Boolean)
    .filter(
      (userId) =>
        input.includeActor === true ||
        !input.actorUserId ||
        userId !== input.actorUserId
    )
    .slice(0, 5_000);
}

export function validateCircleNotification(input: {
  idempotencyKey: string;
  type: string;
  title: string;
  body: string;
  recipients: string[];
}) {
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) {
    throw new Error('Clé de notification collective invalide.');
  }
  if (!PROFILE_CIRCLE_NOTIFICATION_TYPES.includes(
    input.type as ProfileCircleNotificationType
  )) {
    throw new Error('Type de notification collective inconnu.');
  }
  if (!input.title.trim() || input.title.length > 120) {
    throw new Error('Titre de notification collective invalide.');
  }
  if (!input.body.trim() || input.body.length > 500) {
    throw new Error('Corps de notification collective invalide.');
  }
  if (input.recipients.length === 0) {
    return { deliver: false, reason: 'NO_RECIPIENT' } as const;
  }
  return { deliver: true, reason: 'VALID' } as const;
}

export function circleNotificationLink(input: {
  circleSlug?: string | null;
  management?: boolean;
}) {
  if (input.management) return '/profile-circle-governance';
  if (input.circleSlug) {
    return `/circles/${encodeURIComponent(input.circleSlug)}`;
  }
  return '/profile-circles';
}
