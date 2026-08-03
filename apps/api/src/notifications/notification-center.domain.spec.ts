import {
  classifyNotificationType,
  defaultNotificationPreference,
  groupNotificationRows,
  isQuietMinute,
  normalizeCategorySettings,
  resolveNotificationDelivery
} from './notification-center.domain';

describe('notification center domain', () => {
  it('classifies collective, secret and security events', () => {
    expect(classifyNotificationType('CIRCLE_INVITATION')).toBe('CIRCLES');
    expect(classifyNotificationType('SECRET_MESSAGE_RECEIVED')).toBe('SECRET');
    expect(classifyNotificationType('SECURITY_CAPTURE_DETECTED')).toBe('SECURITY');
  });

  it('supports quiet hours crossing midnight', () => {
    expect(isQuietMinute(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isQuietMinute(6 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isQuietMinute(12 * 60, 22 * 60, 7 * 60)).toBe(false);
  });

  it('never disables security and system categories', () => {
    const settings = normalizeCategorySettings({ SECURITY: false, SYSTEM: false, SOCIAL: false });
    expect(settings.SECURITY).toBe(true);
    expect(settings.SYSTEM).toBe(true);
    expect(settings.SOCIAL).toBe(false);
  });

  it('keeps critical alerts visible while respecting quiet hours for realtime', () => {
    const preference = defaultNotificationPreference();
    preference.masterEnabled = false;
    preference.quietHoursEnabled = true;
    const delivery = resolveNotificationDelivery({
      type: 'SECURITY_LOGIN_ALERT',
      minuteOfDay: 23 * 60,
      preference
    });
    expect(delivery.visibleInCenter).toBe(true);
    expect(delivery.realtime).toBe(false);
    expect(delivery.reason).toBe('QUIET_HOURS');
  });

  it('mutes a collective circle without deleting other notifications', () => {
    const preference = defaultNotificationPreference();
    preference.mutedCircleIds = ['circle-1'];
    const delivery = resolveNotificationDelivery({
      type: 'CIRCLE_STORY_APPROVED',
      circleId: 'circle-1',
      minuteOfDay: 600,
      preference
    });
    expect(delivery.visibleInCenter).toBe(false);
    expect(delivery.reason).toBe('CIRCLE_MUTED');
  });

  it('groups compatible collective alerts within the same hour', () => {
    const createdAt = new Date('2026-08-03T12:10:00.000Z');
    const groups = groupNotificationRows([
      {
        id: 'n1', type: 'CIRCLE_MEMBER_JOINED', title: 'A', body: 'A',
        data: { collectiveNotification: true, circleId: 'c1', route: '/circles/c1' },
        readAt: null, createdAt
      },
      {
        id: 'n2', type: 'CIRCLE_MEMBER_JOINED', title: 'B', body: 'B',
        data: { collectiveNotification: true, circleId: 'c1', route: '/circles/c1' },
        readAt: createdAt, createdAt: new Date('2026-08-03T12:20:00.000Z')
      }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 2, unreadCount: 1, grouped: true });
  });
});
