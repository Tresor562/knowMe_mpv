import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessControlService
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { userId?: string };
    }>();
    const userId = request.user?.userId;
    if (!userId || !(await this.access.hasAll(userId, required))) {
      throw new ForbiddenException('Permission insuffisante.');
    }
    return true;
  }
}
