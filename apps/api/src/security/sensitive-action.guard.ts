import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { SecurityService } from './security.service';

@Injectable()
export class SensitiveActionGuard implements CanActivate {
  constructor(private readonly security: SecurityService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: { userId?: string; sessionId?: string };
      headers: Record<string, string | string[] | undefined>;
      securityAssurance?: string;
    }>();
    const userId = request.user?.userId;
    const sessionId = request.user?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Session authentifiée requise.');
    }

    if (await this.security.sessionIsRecent(sessionId)) {
      request.securityAssurance = 'RECENT_SESSION';
      return true;
    }

    const header = request.headers['x-reauth-token'];
    const proofToken = Array.isArray(header) ? header[0] : header;
    if (!proofToken) {
      throw new UnauthorizedException(
        'Réauthentification récente requise pour cette action.'
      );
    }

    request.securityAssurance =
      await this.security.consumeReauthenticationProof(
        userId,
        sessionId,
        proofToken
      );
    return true;
  }
}
