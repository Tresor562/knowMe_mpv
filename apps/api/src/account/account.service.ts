import {
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationPrivacyService } from '../verification/verification-privacy.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationPrivacy: VerificationPrivacyService
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
    const [user, verification] = await Promise.all([
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
      this.verificationPrivacy.exportForAccount(userId)
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
      formatVersion: 2,
      account: safeUser,
      verification
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

    const privateStorageKeys =
      await this.verificationPrivacy.storageKeysForAccount(userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ACCOUNT_DELETE',
          entity: 'User',
          entityId: userId,
          metadata: {
            username: user.username,
            requestedAt: new Date().toISOString(),
            verificationDocumentsErased: privateStorageKeys.length
          }
        }
      });

      await tx.verifiedIdentity.deleteMany({ where: { userId } });
      await tx.verificationRequest.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    await this.verificationPrivacy.removePrivateFiles(privateStorageKeys);

    return {
      deleted: true
    };
  }
}
