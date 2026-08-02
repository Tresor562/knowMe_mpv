import { QuestsService } from './quests.service';

describe('QuestsService', () => {
  const service = new QuestsService({} as never);

  it('normalizes every contribution to its UTC quest day', () => {
    expect(service.questDay(new Date('2026-08-02T23:59:59.000Z'))).toEqual(
      new Date('2026-08-02T00:00:00.000Z')
    );
    expect(service.questDay(new Date('2026-08-03T00:00:01.000Z'))).toEqual(
      new Date('2026-08-03T00:00:00.000Z')
    );
  });

  it('does not mutate the supplied timestamp', () => {
    const input = new Date('2026-08-02T18:30:00.000Z');
    const before = input.toISOString();

    service.questDay(input);

    expect(input.toISOString()).toBe(before);
  });
});
