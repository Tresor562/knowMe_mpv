import { DailyChestService } from './daily-chest.service';

describe('DailyChestService', () => {
  const service = new DailyChestService({} as never, {} as never);

  it('normalizes every claim to one UTC calendar day', () => {
    expect(service.chestDay(new Date('2026-08-02T00:00:00.000Z'))).toEqual(
      new Date('2026-08-02T00:00:00.000Z')
    );
    expect(service.chestDay(new Date('2026-08-02T23:59:59.999Z'))).toEqual(
      new Date('2026-08-02T00:00:00.000Z')
    );
    expect(service.chestDay(new Date('2026-08-03T00:00:00.000Z'))).toEqual(
      new Date('2026-08-03T00:00:00.000Z')
    );
  });
});
