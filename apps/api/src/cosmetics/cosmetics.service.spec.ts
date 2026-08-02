import { BadRequestException } from '@nestjs/common';
import { CosmeticsService } from './cosmetics.service';

describe('CosmeticsService', () => {
  const service = new CosmeticsService({} as never, {} as never);

  it('publishes a strictly visual and server-authoritative policy', () => {
    expect(service.rules()).toEqual({
      serverAuthoritative: true,
      purelyVisual: true,
      purchasesEnabled: false,
      premiumPowerAllowed: false,
      clientGrantedOwnershipAllowed: false,
      oneEquippedItemPerSlot: true
    });
  });

  it('accepts only the bounded equipment slots', () => {
    expect(() => service.assertSlot('AVATAR_FRAME')).not.toThrow();
    expect(() => service.assertSlot('PROFILE_THEME')).not.toThrow();
    expect(() => service.assertSlot('CHAT_BUBBLE')).not.toThrow();
    expect(() => service.assertSlot('PROFILE_ACCENT')).not.toThrow();
    expect(() => service.assertSlot('POWER_BOOST')).toThrow(BadRequestException);
  });
});
