import { StreaksService } from './streaks.service';

describe('StreaksService', () => {
  const service = new StreaksService({} as never);

  it('counts one activity per normalized UTC day', () => {
    expect(
      service.calculateProjection([
        new Date('2026-08-01T01:00:00.000Z'),
        new Date('2026-08-01T22:30:00.000Z'),
        new Date('2026-08-02T12:00:00.000Z')
      ])
    ).toEqual({
      currentDays: 2,
      longestDays: 2,
      lastActivityDate: new Date('2026-08-02T00:00:00.000Z')
    });
  });

  it('keeps continuity across one missed day', () => {
    expect(
      service.calculateProjection([
        new Date('2026-08-01T12:00:00.000Z'),
        new Date('2026-08-03T12:00:00.000Z'),
        new Date('2026-08-04T12:00:00.000Z')
      ])
    ).toEqual(
      expect.objectContaining({ currentDays: 3, longestDays: 3 })
    );
  });

  it('starts a new current series after a longer break and preserves the record', () => {
    expect(
      service.calculateProjection([
        new Date('2026-07-01T12:00:00.000Z'),
        new Date('2026-07-02T12:00:00.000Z'),
        new Date('2026-07-03T12:00:00.000Z'),
        new Date('2026-07-10T12:00:00.000Z'),
        new Date('2026-07-11T12:00:00.000Z')
      ])
    ).toEqual(
      expect.objectContaining({ currentDays: 2, longestDays: 3 })
    );
  });

  it('returns an empty projection before the first eligible activity', () => {
    expect(service.calculateProjection([])).toEqual({
      currentDays: 0,
      longestDays: 0,
      lastActivityDate: null
    });
  });
});
