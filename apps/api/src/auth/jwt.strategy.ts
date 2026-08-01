import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { staffAccountSelect, toStaffBadge } from '../staff/staff-profile';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET')
    });
  }

  async validate(payload: {
    sub?: string;
    username?: string;
    role?: string;
    sid?: string;
  }) {
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException('Session invalide.');
    }

    const now = new Date();
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          role: true,
          isSuspended: true,
          staffAccount: { select: staffAccountSelect }
        }
      }),
      this.prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        select: { id: true }
      })
    ]);

    if (!user || user.isSuspended || !session) {
      throw new UnauthorizedException('Session expirée ou révoquée.');
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: session.id,
      staff: toStaffBadge(user.staffAccount)
    };
  }
}
