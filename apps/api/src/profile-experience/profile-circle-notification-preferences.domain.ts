import { ProfileCircleNotificationType } from './profile-circle-notifications.domain';

export const PROFILE_CIRCLE_NOTIFICATION_CATEGORIES = [
  'INVITATIONS',
  'MEMBERSHIP',
  'GOVERNANCE',
  'CONTENT',
  'FAMILY'
] as const;
export type ProfileCircleNotificationCategory =
  (typeof PROFILE_CIRCLE_NOTIFICATION_CATEGORIES)[number];

export type ProfileCircleNotificationPreferenceSnapshot = {
  enabled: boolean;
  invitationsEnabled: boolean;
  membershipEnabled: boolean;
  governanceEnabled: boolean;
  contentEnabled: boolean;
  familyEnabled: boolean;
  realtimeEnabled: boolean;
  mutedCircleIds: string[];
};

const MANDATORY_TYPES = new Set<ProfileCircleNotificationType>([
  'CIRCLE_MEMBER_REMOVED',
  'CIRCLE_ROLE_CHANGED',
  'CIRCLE_TRANSFER_CREATED',
  'CIRCLE_TRANSFER_ACCEPTED',
  'CIRCLE_TRANSFER_CANCELLED',
  'CIRCLE_CONTENT_APPROVED',
  'CIRCLE_CONTENT_HIDDEN',
  'CIRCLE_CONTENT_REMOVED'
]);

export function notificationCategory(
  type: ProfileCircleNotificationType
): ProfileCircleNotificationCategory {
  if (
    ['CIRCLE_INVITATION', 'CIRCLE_INVITATION_ACCEPTED', 'CIRCLE_INVITATION_DECLINED'].includes(type)
  ) {
    return 'INVITATIONS';
  }
  if (
    [
      'CIRCLE_MEMBER_LEFT',
      'CIRCLE_MEMBER_REMOVED',
      'CIRCLE_JOIN_REQUESTED',
      'CIRCLE_JOIN_APPROVED',
      'CIRCLE_JOIN_DECLINED'
    ].includes(type)
  ) {
    return 'MEMBERSHIP';
  }
  if (
    [
      'CIRCLE_LIFECYCLE_CHANGED',
      'CIRCLE_ROLE_CHANGED',
      'CIRCLE_TRANSFER_CREATED',
      'CIRCLE_TRANSFER_ACCEPTED',
      'CIRCLE_TRANSFER_CANCELLED'
    ].includes(type)
  ) {
    return 'GOVERNANCE';
  }
  if (
    [
      'CIRCLE_CONTENT_APPROVED',
      'CIRCLE_CONTENT_HIDDEN',
      'CIRCLE_CONTENT_REMOVED'
    ].includes(type)
  ) {
    return 'CONTENT';
  }
  return 'FAMILY';
}

export function isMandatoryCircleNotification(
  type: ProfileCircleNotificationType
) {
  return MANDATORY_TYPES.has(type);
}

export function normalizeMutedCircleIds(values: unknown) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values)]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 500);
}

export function resolveCircleNotificationPreference(input: {
  type: ProfileCircleNotificationType;
  circleId?: string | null;
  preference: ProfileCircleNotificationPreferenceSnapshot;
}) {
  const mandatory = isMandatoryCircleNotification(input.type);
  const category = notificationCategory(input.type);
  const muted = Boolean(
    input.circleId && input.preference.mutedCircleIds.includes(input.circleId)
  );
  const categoryEnabled =
    category === 'INVITATIONS'
      ? input.preference.invitationsEnabled
      : category === 'MEMBERSHIP'
        ? input.preference.membershipEnabled
        : category === 'GOVERNANCE'
          ? input.preference.governanceEnabled
          : category === 'CONTENT'
            ? input.preference.contentEnabled
            : input.preference.familyEnabled;

  const inboxAllowed = mandatory || (
    input.preference.enabled &&
    categoryEnabled &&
    !muted
  );

  return {
    category,
    mandatory,
    muted,
    inboxAllowed,
    realtimeAllowed: inboxAllowed && input.preference.realtimeEnabled
  } as const;
}

export function defaultCircleNotificationPreference(): ProfileCircleNotificationPreferenceSnapshot {
  return {
    enabled: true,
    invitationsEnabled: true,
    membershipEnabled: true,
    governanceEnabled: true,
    contentEnabled: true,
    familyEnabled: true,
    realtimeEnabled: true,
    mutedCircleIds: []
  };
}
