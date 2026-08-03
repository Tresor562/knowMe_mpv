import {
  defaultCircleNotificationPreference,
  normalizeMutedCircleIds,
  notificationCategory,
  resolveCircleNotificationPreference
} from './profile-circle-notification-preferences.domain';

describe('collective notification preferences', () => {
  it('maps notification types to understandable categories', () => {
    expect(notificationCategory('CIRCLE_INVITATION')).toBe('INVITATIONS');
    expect(notificationCategory('CIRCLE_JOIN_REQUESTED')).toBe('MEMBERSHIP');
    expect(notificationCategory('CIRCLE_TRANSFER_CREATED')).toBe('GOVERNANCE');
    expect(notificationCategory('CIRCLE_CONTENT_APPROVED')).toBe('CONTENT');
    expect(notificationCategory('FAMILY_RELATION_PROPOSED')).toBe('FAMILY');
  });

  it('lets users mute optional invitations for one circle', () => {
    const preference = {
      ...defaultCircleNotificationPreference(),
      mutedCircleIds: ['circle-1']
    };
    expect(
      resolveCircleNotificationPreference({
        type: 'CIRCLE_INVITATION',
        circleId: 'circle-1',
        preference
      })
    ).toMatchObject({ inboxAllowed: false, muted: true, mandatory: false });
  });

  it('keeps transactional ownership and moderation events in the inbox', () => {
    const preference = {
      ...defaultCircleNotificationPreference(),
      enabled: false,
      governanceEnabled: false,
      contentEnabled: false,
      mutedCircleIds: ['circle-1']
    };
    expect(
      resolveCircleNotificationPreference({
        type: 'CIRCLE_TRANSFER_CREATED',
        circleId: 'circle-1',
        preference
      })
    ).toMatchObject({ inboxAllowed: true, mandatory: true });
    expect(
      resolveCircleNotificationPreference({
        type: 'CIRCLE_CONTENT_REMOVED',
        circleId: 'circle-1',
        preference
      })
    ).toMatchObject({ inboxAllowed: true, mandatory: true });
  });

  it('allows disabling realtime while preserving inbox delivery', () => {
    const preference = {
      ...defaultCircleNotificationPreference(),
      realtimeEnabled: false
    };
    expect(
      resolveCircleNotificationPreference({
        type: 'CIRCLE_INVITATION',
        circleId: 'circle-1',
        preference
      })
    ).toMatchObject({ inboxAllowed: true, realtimeAllowed: false });
  });

  it('normalizes muted circles without exposing unbounded input', () => {
    expect(normalizeMutedCircleIds(['a', 'a', '', null, ' b '])).toEqual([
      'a',
      'b'
    ]);
    expect(normalizeMutedCircleIds(Array.from({ length: 700 }, (_, i) => `c-${i}`))).toHaveLength(500);
  });
});
