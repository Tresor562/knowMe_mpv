import {
  isMinuteInQuietWindow,
  localMinuteOfDay,
  resolveNotificationDeliverySchedule,
  validateNotificationSchedulePreference
} from './profile-circle-notification-schedule.domain';
import { defaultCircleNotificationPreference } from './profile-circle-notification-preferences.domain';

function preference(overrides: Record<string, unknown> = {}) {
  return {
    ...defaultCircleNotificationPreference(),
    quietHoursEnabled: true,
    quietStartMinute: 22 * 60,
    quietEndMinute: 7 * 60,
    timezone: 'Africa/Porto-Novo',
    digestMode: 'OFF' as const,
    digestMinuteOfDay: 8 * 60,
    ...overrides
  };
}

describe('collective notification scheduling', () => {
  it('recognizes overnight and same-day quiet windows', () => {
    expect(isMinuteInQuietWindow(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isMinuteInQuietWindow(6 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isMinuteInQuietWindow(12 * 60, 22 * 60, 7 * 60)).toBe(false);
    expect(isMinuteInQuietWindow(13 * 60, 12 * 60, 14 * 60)).toBe(true);
  });

  it('defers optional alerts until quiet hours end', () => {
    const now = new Date('2026-08-03T22:30:00Z');
    const decision = resolveNotificationDeliverySchedule({
      type: 'CIRCLE_INVITATION',
      circleId: 'circle-1',
      preference: preference(),
      now
    });
    expect(decision).toMatchObject({
      deliveryMode: 'AFTER_QUIET_HOURS',
      quietHoursActive: true,
      realtimeAllowed: false,
      mandatory: false
    });
    expect(localMinuteOfDay(decision.availableAt, 'Africa/Porto-Novo')).toBe(7 * 60);
  });

  it('keeps mandatory alerts in the inbox but suppresses realtime in quiet hours', () => {
    const decision = resolveNotificationDeliverySchedule({
      type: 'CIRCLE_TRANSFER_CREATED',
      circleId: 'circle-1',
      preference: preference(),
      now: new Date('2026-08-03T22:30:00Z')
    });
    expect(decision).toMatchObject({
      deliveryMode: 'INSTANT',
      inboxAllowed: true,
      realtimeAllowed: false,
      mandatory: true,
      quietHoursActive: true
    });
  });

  it('groups optional alerts into the next daily digest', () => {
    const decision = resolveNotificationDeliverySchedule({
      type: 'CIRCLE_JOIN_REQUESTED',
      circleId: 'circle-1',
      preference: preference({ digestMode: 'DAILY' }),
      now: new Date('2026-08-03T10:00:00Z')
    });
    expect(decision.deliveryMode).toBe('DAILY_DIGEST');
    expect(decision.realtimeAllowed).toBe(false);
    expect(localMinuteOfDay(decision.availableAt, 'Africa/Porto-Novo')).toBe(8 * 60);
    expect(decision.availableAt.getTime()).toBeGreaterThan(
      new Date('2026-08-03T10:00:00Z').getTime()
    );
  });

  it('validates minute ranges and IANA timezones', () => {
    expect(
      validateNotificationSchedulePreference({
        quietStartMinute: 1320,
        quietEndMinute: 420,
        digestMinuteOfDay: 480,
        timezone: 'Africa/Porto-Novo'
      })
    ).toBe(true);
    expect(() =>
      validateNotificationSchedulePreference({
        quietStartMinute: 1440,
        quietEndMinute: 420,
        digestMinuteOfDay: 480,
        timezone: 'UTC'
      })
    ).toThrow('Minute');
    expect(() =>
      validateNotificationSchedulePreference({
        quietStartMinute: 1320,
        quietEndMinute: 420,
        digestMinuteOfDay: 480,
        timezone: 'Mars/Olympus'
      })
    ).toThrow('Fuseau');
  });
});
