import { LeaderboardsService } from './leaderboards.service';

describe('LeaderboardsService', () => {
  const service = new LeaderboardsService({} as never);

  it('uses a Monday-to-Monday UTC window', () => {
    expect(service.weekWindow(new Date('2026-08-02T23:59:59.000Z'))).toEqual({
      start: new Date('2026-07-27T00:00:00.000Z'),
      end: new Date('2026-08-03T00:00:00.000Z')
    });
    expect(service.weekWindow(new Date('2026-08-03T00:00:00.000Z'))).toEqual({
      start: new Date('2026-08-03T00:00:00.000Z'),
      end: new Date('2026-08-10T00:00:00.000Z')
    });
  });

  it('caps ranking XP without changing the real XP value', () => {
    expect(service.rankingScore(-10)).toBe(0);
    expect(service.rankingScore(499.9)).toBe(499);
    expect(service.rankingScore(500)).toBe(500);
    expect(service.rankingScore(2500)).toBe(500);
  });
});
