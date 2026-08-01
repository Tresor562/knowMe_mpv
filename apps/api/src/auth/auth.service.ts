import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecurityContext,
  SecurityService
} from '../security/security.service';
import { VerifyLoginTwoFactorDto } from '../security/dto/security.dto';
import {
  StaffProfileRecord,
  staffAccountSelect,
  toStaffBadge
} from '../staff/staff-profile';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

type SessionContext = SecurityContext;

type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  staffAccount: StaffProfileRecord;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly security: SecurityService
  ) {}

  async register(dto: RegisterDto, context: SessionContext = {}) {
    const email = dto.email.toLowerCase();
    const username = dto.username.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existing) {
      throw new ConflictException(
        'Email ou nom utilisateur déjà utilisé.'
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        displayName: dto.displayName,
        passwordHash: await argon2.hash(dto.password),
        knowCoinWallet: { create: { balance: 0 } }
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        staffAccount: { select: staffAccountSelect }
      }
    });

    return this.createSession(user, context, 'REGISTRATION');
  }

  async login(dto: LoginDto, context: SessionContext = {}) {
    const identifier = dto.identifier.toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }]
      },
      include: {
        staffAccount: { select: staffAccountSelect }
      }
    });

    if (
      !user ||
      user.isSuspended ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const secondFactor = await this.security.beginLogin(
      user.id,
      dto.deviceToken,
      context
    );
    if (secondFactor.required) {
      return {
        requiresTwoFactor: true,
        challengeToken: secondFactor.challengeToken,
        expiresAt: secondFactor.expiresAt,
        expiresIn: secondFactor.expiresIn
      };
    }

    return this.createSession(
      this.toSessionUser(user),
      context,
      secondFactor.assurance
    );
  }

  async completeTwoFactorLogin(
    dto: VerifyLoginTwoFactorDto,
    context: SessionContext = {}
  ) {
    const verification = await this.security.completeLoginChallenge(
      dto.challengeToken,
      dto.code,
      context
    );
    const user = await this.prisma.user.findUnique({
      where: { id: verification.userId },
      include: { staffAccount: { select: staffAccountSelect } }
    });
    if (!user || user.isSuspended) {
      throw new UnauthorizedException('Compte indisponible.');
    }

    const session = await this.createSession(
      this.toSessionUser(user),
      context,
      verification.factor.method
    );

    if (!dto.trustDevice) return session;

    const trusted = await this.security.issueTrustedDevice(
      user.id,
      session.sessionId,
      dto.deviceLabel,
      dto.platform,
      context
    );
    return {
      ...session,
      trustedDeviceToken: trusted.token,
      trustedDevice: {
        id: trusted.deviceId,
        trustedUntil: trusted.trustedUntil
      }
    };
  }

  async refresh(dto: RefreshTokenDto, context: SessionContext = {}) {
    const [sessionId, secret] = dto.refreshToken.split('.');

    if (!sessionId || !secret) {
      throw new UnauthorizedException('Jeton de renouvellement invalide.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            staffAccount: { select: staffAccountSelect }
          }
        }
      }
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.isSuspended
    ) {
      throw new UnauthorizedException('Session expirée ou révoquée.');
    }

    const valid = await argon2.verify(session.refreshTokenHash, secret);

    if (!valid) {
      throw new UnauthorizedException('Jeton de renouvellement invalide.');
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    return this.createSession(
      this.toSessionUser(session.user),
      context,
      'REFRESH'
    );
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.authSession.updateMany({
        where: {
          id: sessionId,
          userId,
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
    } else {
      await this.prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
    }

    return { loggedOut: true };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    return { revoked: true };
  }

  private async createSession(
    user: SessionUser,
    context: SessionContext,
    assurance: string
  ) {
    const secret = randomBytes(48).toString('base64url');
    const refreshTokenHash = await argon2.hash(secret);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt
      }
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
      sid: session.id,
      amr: assurance
    });

    await this.security
      .recordSessionCreated(user.id, session.id, context, assurance)
      .catch(() => undefined);

    const { staffAccount, ...publicUser } = user;

    return {
      user: {
        ...publicUser,
        accountId: user.id,
        staff: toStaffBadge(staffAccount)
      },
      accessToken,
      refreshToken: `${session.id}.${secret}`,
      expiresIn: 60 * 60 * 24 * 7,
      sessionId: session.id,
      assurance
    };
  }

  private toSessionUser(user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    staffAccount: StaffProfileRecord;
  }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      staffAccount: user.staffAccount
    };
  }
}
