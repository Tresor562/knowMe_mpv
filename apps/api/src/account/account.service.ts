import {
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrivacyService } from '../privacy/privacy.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly privacy: PrivacyService
  ) {}

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        knowCoins: true,
        updatedAt: true
      }
    });
  }

  async exportData(userId: string) {
    const [user, security, privacy] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          interests: {
            include: { interest: true }
          },
          posts: {
            include: {
              comments: true,
              likes: true
            }
          },
          challengeEntries: {
            include: {
              answers: true,
              challenge: {
                include: { questions: true }
              }
            }
          },
          sentMessages: true,
          memberships: {
            include: {
              conversation: true
            }
          },
          sentFriendships: true,
          receivedFriendships: true,
          notifications: true,
          authSessions: {
            select: {
              id: true,
              userAgent: true,
              ipAddress: true,
              createdAt: true,
              updatedAt: true,
              expiresAt: true,
              revokedAt: true
            }
          }
        }
      }),
      this.security.exportForAccount(userId),
      this.privacy.exportForAccount(userId)
    ]);

    if (!user) {
      throw new UnauthorizedException('Compte introuvable.');
    }

    const {
      passwordHash,
      ...safeUser
    } = user;

    return {
      exportedAt: new Date().toISOString(),
      formatVersion: 3,
      account: safeUser,
      security,
      privacy
    };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (
      !user ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ACCOUNT_DELETE',
          entity: 'User',
          entityId: userId,
          metadata: {
            username: user.username,
            requestedAt: new Date().toISOString()
          }
        }
      });

      await tx.privacyConsentEvent.deleteMany({ where: { userId } });
      await tx.privacyPreference.deleteMany({ where: { userId } });
      await tx.dataSubjectRequest.deleteMany({ where: { userId } });
      await tx.securityRecoveryCode.deleteMany({ where: { userId } });
      await tx.securityChallenge.deleteMany({ where: { userId } });
      await tx.trustedDevice.deleteMany({ where: { userId } });
      await tx.reauthenticationProof.deleteMany({ where: { userId } });
      await tx.securityEvent.deleteMany({ where: { userId } });
      await tx.accountSecurity.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return {
      deleted: true
    };
  }
}
