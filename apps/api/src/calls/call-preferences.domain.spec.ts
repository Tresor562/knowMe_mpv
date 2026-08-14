import {
  DEFAULT_CALL_PREFERENCE,
  isQuietAt,
  minuteInTimezone,
  normalizeCallPreference
} from './call-preferences.domain';

describe('call preference domain', () => {
  it('normalizes missing values to privacy-safe product defaults', () => {
    expect(normalizeCallPreference({ allowVideoCalls: false })).toEqual({
      ...DEFAULT_CALL_PREFERENCE,
      allowVideoCalls: false
    });
  });

  it('evaluates quiet hours that cross midnight in the user timezone', () => {
    const preference = normalizeCallPreference({
      quietHoursEnabled: true,
      quietStartMinute: 22 * 60,
      quietEndMinute: 7 * 60,
      timezone: 'Africa/Porto-Novo'
    });

    expect(isQuietAt(preference, new Date('2026-08-14T22:30:00.000Z'))).toBe(
      true
    );
    expect(isQuietAt(preference, new Date('2026-08-15T06:30:00.000Z'))).toBe(
      false
    );
  });

  it('treats equal enabled boundaries as an explicit all-day quiet window', () => {
    const preference = normalizeCallPreference({
      quietHoursEnabled: true,
      quietStartMinute: 0,
      quietEndMinute: 0
    });

    expect(isQuietAt(preference, new Date('2026-08-14T12:00:00.000Z'))).toBe(
      true
    );
  });

  it('resolves local minutes without depending on the server timezone', () => {
    expect(
      minuteInTimezone(
        new Date('2026-08-14T12:30:00.000Z'),
        'Africa/Porto-Novo'
      )
    ).toBe(13 * 60 + 30);
  });
});
