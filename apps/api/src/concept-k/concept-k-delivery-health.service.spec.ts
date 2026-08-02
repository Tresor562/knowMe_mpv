import { ConceptKDeliveryHealthService } from './concept-k-delivery-health.service';

describe('ConceptKDeliveryHealthService', () => {
  const service = new ConceptKDeliveryHealthService(
    {} as never,
    {} as never,
    {} as never
  );

  it('requires five samples, four failures and an eighty percent rate', () => {
    expect(service.shouldQuarantine(4, 4)).toBe(false);
    expect(service.shouldQuarantine(5, 3)).toBe(false);
    expect(service.shouldQuarantine(5, 4)).toBe(true);
    expect(service.shouldQuarantine(10, 7)).toBe(false);
    expect(service.shouldQuarantine(10, 8)).toBe(true);
  });

  it('normalizes one health sample per UTC day', () => {
    expect(service.utcDay(new Date('2026-08-02T23:59:59.000Z'))).toEqual(
      new Date('2026-08-02T00:00:00.000Z')
    );
    expect(service.utcDay(new Date('2026-08-03T00:00:01.000Z'))).toEqual(
      new Date('2026-08-03T00:00:00.000Z')
    );
  });

  it('publishes a multi-account policy without Premium bypass', () => {
    expect(service.policy()).toEqual({
      healthWindowHours: 24,
      minimumSamples: 5,
      minimumFailures: 4,
      failureRateThreshold: 0.8,
      oneSamplePerAccountAssetDay: true,
      automaticFallback: true,
      premiumBypassAllowed: false
    });
  });
});
