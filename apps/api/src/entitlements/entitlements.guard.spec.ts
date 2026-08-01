import {
  ForbiddenException,
  UnauthorizedException
} from '@nestjs/common';
import { EntitlementsGuard } from './entitlements.guard';

describe('EntitlementsGuard', () => {
  function context(userId?: string) {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { userId } : undefined,
          headers: {
            'x-entitlements': 'premium.core',
            'x-premium': 'true'
          }
        })
      })
    } as never;
  }

  it('requires authentication for an exclusive route', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['premium.core'])
    };
    const entitlements = { hasAll: jest.fn() };
    const guard = new EntitlementsGuard(reflector as never, entitlements as never);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(entitlements.hasAll).not.toHaveBeenCalled();
  });

  it('ignores forged client headers and trusts the server lookup only', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['premium.core'])
    };
    const entitlements = { hasAll: jest.fn().mockResolvedValue(false) };
    const guard = new EntitlementsGuard(reflector as never, entitlements as never);

    await expect(guard.canActivate(context('account-1'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(entitlements.hasAll).toHaveBeenCalledWith('account-1', [
      'premium.core'
    ]);
  });

  it('allows access only after the authoritative server check succeeds', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['premium.core'])
    };
    const entitlements = { hasAll: jest.fn().mockResolvedValue(true) };
    const guard = new EntitlementsGuard(reflector as never, entitlements as never);

    await expect(guard.canActivate(context('account-1'))).resolves.toBe(true);
  });
});
