import { PositiveChallengesService } from './positive-challenges.service';

describe('PositiveChallengesService', () => {
  const service = new PositiveChallengesService({} as never, {} as never, {} as never);

  it('normalizes invitation limits to a UTC day', () => {
    expect(service.utcDay(new Date('2026-08-02T23:59:59.000Z'))).toEqual(
      new Date('2026-08-02T00:00:00.000Z')
    );
    expect(service.utcDay(new Date('2026-08-03T00:00:01.000Z'))).toEqual(
      new Date('2026-08-03T00:00:00.000Z')
    );
  });

  it('publishes consent-first rules and no reward', () => {
    expect(service.catalog()).toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ key: 'GRATITUDE_NOTE' }),
          expect.objectContaining({ key: 'HELPING_HAND' })
        ]),
        rules: expect.objectContaining({
          explicitConsent: true,
          refusalPenalty: false,
          cancellationPenalty: false,
          doubleConfirmation: true,
          reward: null,
          paidBoostsAllowed: false
        })
      })
    );
  });
});
