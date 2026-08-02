import { ConceptKService } from './concept-k.service';

describe('ConceptKService', () => {
  it('forces a static fallback when the user disables animations', async () => {
    const prisma = {
      userAnimationPreference: {
        upsert: jest.fn().mockResolvedValue({
          userId: 'user-1',
          mode: 'OFF',
          soundEnabled: true,
          hapticsEnabled: true
        })
      }
    };
    const service = new ConceptKService(prisma as never, {} as never);

    const resolved = await service.resolve('user-1', {
      eventKey: 'LEVEL_UP',
      clientReducedMotion: false,
      deviceClass: 'HIGH'
    });

    expect(resolved.plan).toEqual(
      expect.objectContaining({
        variant: 'STATIC',
        shouldAnimate: false,
        reason: 'USER_DISABLED',
        soundEnabled: false,
        hapticsEnabled: false,
        blocking: false,
        skippable: true
      })
    );
  });

  it('honors system reduced motion before the automatic device plan', async () => {
    const prisma = {
      userAnimationPreference: {
        upsert: jest.fn().mockResolvedValue({
          userId: 'user-2',
          mode: 'AUTO',
          soundEnabled: true,
          hapticsEnabled: true
        })
      }
    };
    const service = new ConceptKService(prisma as never, {} as never);

    const resolved = await service.resolve('user-2', {
      eventKey: 'CHALLENGE_COMPLETED',
      clientReducedMotion: true,
      deviceClass: 'HIGH'
    });

    expect(resolved.plan.variant).toBe('REDUCED');
    expect(resolved.plan.reason).toBe('SYSTEM_REDUCED_MOTION');
    expect(resolved.plan.soundEnabled).toBe(false);
  });

  it('publishes a static fallback for every catalog event', () => {
    const service = new ConceptKService({} as never, {} as never);
    const catalog = service.catalog();

    expect(catalog.events).toHaveLength(10);
    expect(catalog.events.every((event) => event.fallbackLabel && event.fallbackSymbol)).toBe(true);
    expect(catalog.rules).toEqual(
      expect.objectContaining({
        blocking: false,
        skippable: true,
        staticFallbackRequired: true,
        contentCaptured: false
      })
    );
  });
});
