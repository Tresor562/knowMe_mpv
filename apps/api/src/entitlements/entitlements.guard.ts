import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENTS_KEY } from './entitlements.decorator';
import { EntitlementsService } from './entitlements.service';

@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(
      ENTITLEMENTS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { userId?: string };
    }>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Authentification requise.');
    }

    const allowed = await this.entitlements.hasAll(userId, required);
    if (!allowed) {
      throw new ForbiddenException(
        'Cette fonctionnalité nécessite un droit exclusif actif.'
      );
    }

    return true;
  }
}
