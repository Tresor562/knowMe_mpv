import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  function context(userId?: string) {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { userId } : undefined })
      })
    } as unknown as ExecutionContext;
  }

  it('allows routes without declared permissions', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined)
    } as unknown as Reflector;
    const access = { hasAll: jest.fn() } as unknown as AccessControlService;
    const guard = new PermissionsGuard(reflector, access);

    await expect(guard.canActivate(context('account-1'))).resolves.toBe(true);
  });

  it('checks permissions against the server-side access service', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['staff.manage'])
    } as unknown as Reflector;
    const access = {
      hasAll: jest.fn().mockResolvedValue(true)
    } as unknown as AccessControlService;
    const guard = new PermissionsGuard(reflector, access);

    await expect(guard.canActivate(context('account-1'))).resolves.toBe(true);
    expect(access.hasAll).toHaveBeenCalledWith('account-1', ['staff.manage']);
  });

  it('rejects missing users and forged client state', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['rbac.manage'])
    } as unknown as Reflector;
    const access = {
      hasAll: jest.fn().mockResolvedValue(false)
    } as unknown as AccessControlService;
    const guard = new PermissionsGuard(reflector, access);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(guard.canActivate(context('account-2'))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
