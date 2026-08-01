import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationEligibilityGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: { userId?: string };
    }>();
    const userId = request.user?.userId;
    if (!userId) return false;

    const now = new Date();
    const blockingIdentity = await this.prisma.verifiedIdentity.findFirst({
      where: {
        userId,
        OR: [
          { status: 'SUSPENDED' },
          {
            status: 'ACTIVE',
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          }
        ]
      },
      select: { id: true }
    });

    if (blockingIdentity) {
      throw new ConflictException(
        'Ce compte possède déjà une certification active ou suspendue.'
      );
    }

    return true;
  }
}
