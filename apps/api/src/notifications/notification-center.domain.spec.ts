import {
  classifyNotificationType,
  defaultNotificationCenterPreference,
  groupNotificationCenterRows,
  isQuietMinute,
  localMinuteOfDay,
  normalizeNotificationCategories,
  normalizeNotificationStringList,
  notificationDigestSchedule,
  resolveNotificationCenterDelivery
} from './notification-center.domain';

describe('notification center domain', () => {
  it('classifies stable categories and protects critical types', () => {
    expect(classifyNotificationType('MESSAGE')).toBe('MESSAGING');
    expect(classifyNotificationType('PROFILE_CIRCLE_POST')).toBe('CIRCLES');
    expect(classifyNotificationType('SECURITY_LOGIN_ALERT')).toBe('SECURITY');
    expect(classifyNotificationType('PAYMENT_FAILED')).toBe('SYSTEM');
    expect(classifyNotificationType('CHALLENGE_COMPLETED')).toBe('CHALLENGES');
  });

  it('handles quiet windows that cross midnight', () => {
    expect(isQuietMinute(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isQuietMinute(6 * 60 + 59, 22 * 60, 7 * 60)).toBe(true);
    expect(isQuietMinute(7 * 60, 22 * 60, 7 * 60)).toBe(false);
    expect(isQuietMinute(12 * 60, 22 * 60, 7 * 60)).toBe(false);
  });

  it('applies the most restrictive rule while keeping critical events visible', () => {
    const preference = defaultNotificationCenterPreference();
    preference.masterEnabled = false;
    preference.realtimeEnabled = false;
    preference.categorySettings.SOCIAL = false;
    preference.mutedTypes = ['POST_LIKE'];

    const social = resolveNotificationCenterDelivery({
      type: 'POST_LIKE',
      minuteOfDay: 12 * 60,
      preference
    });
    expect(social.visibleInCenter).toBe(false);
    expect(social.realtime).toBe(false);

    const critical = resolveNotificationCenterDelivery({
      type: 'SECURITY_LOGIN_ALERT',
      minuteOfDay: 23 * 60,
      preference
    });
    expect(critical.visibleInCenter).toBe(true);
    expect(critical.realtime).toBe(true);
    expect(critical.critical).toBe(true);
  });

  it('routes non-critical notifications to hourly and daily summaries', () => {
    const hourly = defaultNotificationCenterPreference();
    hourly.digestMode = 'HOURLY';
    const hourlyDecision = resolveNotificationCenterDelivery({
      type: 'MESSAGE',
      minuteOfDay: 10 * 60,
      preference: hourly
    });
    expect(hourlyDecision.realtime).toBe(false);
    expect(hourlyDecision.digest).toBe(true);
    expect(hourlyDecision.digestMode).toBe('HOURLY');

    const daily = { ...hourly, digestMode: 'DAILY' as const };
    const dailyDecision = resolveNotificationCenterDelivery({
      type: 'POST_COMMENT',
      minuteOfDay: 10 * 60,
      preference: daily
    });
    expect(dailyDecision.digestMode).toBe('DAILY');
  });

  it('normalizes user-controlled lists and critical category settings', () => {
    expect(
      normalizeNotificationStringList([' A ', 'A', '', 1, 'B'], 10)
    ).toEqual(['A', 'B']);
    expect(
      normalizeNotificationCategories({
        SOCIAL: false,
        SECURITY: false,
        SYSTEM: false
      })
    ).toMatchObject({ SOCIAL: false, SECURITY: true, SYSTEM: true });
  });

  it('calculates local minutes and hourly due time for Porto-Novo', () => {
    const now = new Date('2026-08-03T20:30:00.000Z');
    expect(localMinuteOfDay(now, 'Africa/Porto-Novo')).toBe(21 * 60 + 30);
    const schedule = notificationDigestSchedule({
      mode: 'HOURLY',
      now,
      timezone: 'Africa/Porto-Novo',
      dailyDigestMinute: 8 * 60
    });
    expect(schedule.bucketKey).toBe('HOURLY:2026-08-03:21');
    expect(schedule.dueAt.toISOString()).toBe('2026-08-03T21:00:00.000Z');
  });

  it('calculates the next daily local occurrence', () => {
    const before = notificationDigestSchedule({
      mode: 'DAILY',
      now: new Date('2026-08-03T06:30:00.000Z'),
      timezone: 'Africa/Porto-Novo',
      dailyDigestMinute: 8 * 60
    });
    expect(before.dueAt.toISOString()).toBe('2026-08-03T07:00:00.000Z');

    const after = notificationDigestSchedule({
      mode: 'DAILY',
      now: new Date('2026-08-03T08:30:00.000Z'),
      timezone: 'Africa/Porto-Novo',
      dailyDigestMinute: 8 * 60
    });
    expect(after.dueAt.toISOString()).toBe('2026-08-04T07:00:00.000Z');
  });

  it('groups only explicit or collective notifications', () => {
    const rows = [
      {
        id: 'one',
        type: 'PROFILE_CIRCLE_POST',
        title: 'Un',
        body: 'Un',
        data: { collectiveNotification: true, circleId: 'circle-a' },
        readAt: null,
        createdAt: new Date('2026-08-03T20:10:00.000Z')
      },
      {
        id: 'two',
        type: 'PROFILE_CIRCLE_POST',
        title: 'Deux',
        body: 'Deux',
        data: { collectiveNotification: true, circleId: 'circle-a' },
        readAt: new Date('2026-08-03T20:20:00.000Z'),
        createdAt: new Date('2026-08-03T20:20:00.000Z')
      },
      {
        id: 'three',
        type: 'POST_LIKE',
        title: 'Trois',
        body: 'Trois',
        data: {},
        readAt: null,
        createdAt: new Date('2026-08-03T20:30:00.000Z')
      }
    ];
    const groups = groupNotificationCenterRows(rows);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.grouped)?.count).toBe(2);
    expect(groups.find((group) => group.grouped)?.unreadCount).toBe(1);
  });
});
