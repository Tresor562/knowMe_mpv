import {
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppearanceService } from '../appearance/appearance.service';
import { ConceptKService } from '../concept-k/concept-k.service';
import { CosmeticPresetsService } from '../cosmetics/cosmetic-presets.service';
import { CosmeticsService } from '../cosmetics/cosmetics.service';
import { MediaService } from '../media/media.service';
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
    private readonly privacy: PrivacyService,
    private readonly media: MediaService,
    private readonly conceptK: ConceptKService,
    private readonly cosmetics: CosmeticsService,
    private readonly cosmeticPresets: CosmeticPresetsService,
    private readonly appearance: AppearanceService
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
    const [
      user,
      security,
      privacy,
      media,
      challengeResults,
      challengeReferences,
      progressionProfile,
      xpLedger,
      streakProfile,
      streakDays,
      questProgress,
      questContributions,
      achievementPreference,
      achievementGrants,
      leaderboardPreference,
      dailyChestClaims,
      positiveChallenges,
      conceptK,
      conceptKAssetDeliveries,
      cosmetics,
      cosmeticPresets,
      appearance
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          interests: { include: { interest: true } },
          posts: { include: { comments: true, likes: true } },
          challengeEntries: {
            include: {
              answers: true,
              challenge: { include: { questions: true } }
            }
          },
          sentMessages: true,
          memberships: { include: { conversation: true } },
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
      this.privacy.exportForAccount(userId),
      this.media.listMine(userId),
      this.prisma.challengeResultSnapshot.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' }
      }),
      this.prisma.challengeReferenceSnapshot.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.userProgression.findUnique({ where: { userId } }),
      this.prisma.xpLedgerEntry.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.userActivityStreak.findUnique({ where: { userId } }),
      this.prisma.streakActivityDay.findMany({
        where: { userId },
        orderBy: [{ activityDate: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.dailyQuestProgress.findMany({
        where: { userId },
        orderBy: [{ questDate: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.dailyQuestContribution.findMany({
        where: { userId },
        orderBy: [{ questDate: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.userAchievementPreference.findUnique({ where: { userId } }),
      this.prisma.achievementGrant.findMany({
        where: { userId },
        include: { definition: true },
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.leaderboardPreference.findUnique({ where: { userId } }),
      this.prisma.dailyChestClaim.findMany({
        where: { userId },
        orderBy: [{ claimDate: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.positiveChallenge.findMany({
        where: { OR: [{ creatorId: userId }, { recipientId: userId }] },
        include: { events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      this.conceptK.exportForAccount(userId),
      this.prisma.conceptKAssetDeliveryEvent.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      this.cosmetics.exportForAccount(userId),
      this.cosmeticPresets.exportForAccount(userId),
      this.appearance.exportForAccount(userId)
    ]);

    if (!user) throw new UnauthorizedException('Compte introuvable.');
    const { passwordHash, ...safeUser } = user;
    const hasAppearanceData = appearance.preference.version > 0;

    return {
      exportedAt: new Date().toISOString(),
      formatVersion: hasAppearanceData ? 7 : 6,
      account: safeUser,
      security,
      privacy,
      ...(hasAppearanceData ? { appearance } : {}),
      media,
      challengeHistory: challengeResults,
      challengeReferences: challengeReferences.map((reference) => ({
        id: reference.id,
        challengeId: reference.challengeId,
        challengeVersion: reference.challengeVersion,
        createdAt: reference.createdAt,
        answers: Array.isArray(reference.answers)
          ? reference.answers.map((answer) => {
              if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
                return answer;
              }
              const { normalizedHash: _normalizedHash, ...safeAnswer } = answer;
              return safeAnswer;
            })
          : []
      })),
      progression: {
        profile: progressionProfile,
        ledger: xpLedger
      },
      streaks: {
        profile: streakProfile,
        days: streakDays
      },
      quests: {
        progress: questProgress,
        contributions: questContributions
      },
      achievements: {
        preference: achievementPreference,
        grants: achievementGrants
      },
      leaderboards: {
        weeklyXpPreference: leaderboardPreference
      },
      dailyChest: {
        claims: dailyChestClaims
      },
      positiveChallenges: {
        items: positiveChallenges
      },
      conceptK: {
        ...conceptK,
        assetDeliveries: conceptKAssetDeliveries
      },
      cosmetics: {
        ...cosmetics,
        presets: cosmeticPresets
      }
    };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }

    const createdChallenges = await this.prisma.challenge.findMany({
      where: { creatorId: userId },
      select: { id: true }
    });
    const createdChallengeIds = createdChallenges.map((challenge) => challenge.id);

    await this.media.cleanupAccount(userId);
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
      await this.appearance.deleteForAccount(userId, tx);
      await this.cosmeticPresets.deleteForAccount(userId, tx);
      await this.cosmetics.deleteForAccount(userId, tx);
      await tx.conceptKAssetDeliveryEvent.deleteMany({ where: { userId } });
      await this.conceptK.deleteForAccount(userId, tx);
      await tx.positiveChallenge.deleteMany({
        where: { OR: [{ creatorId: userId }, { recipientId: userId }] }
      });
      await tx.dailyChestClaim.deleteMany({ where: { userId } });
      await tx.leaderboardPreference.deleteMany({ where: { userId } });
      await tx.userAchievementPreference.deleteMany({ where: { userId } });
      await tx.achievementGrant.deleteMany({ where: { userId } });
      await tx.dailyQuestContribution.deleteMany({ where: { userId } });
      await tx.dailyQuestProgress.deleteMany({ where: { userId } });
      await tx.streakActivityDay.deleteMany({ where: { userId } });
      await tx.userActivityStreak.deleteMany({ where: { userId } });
      await tx.xpLedgerEntry.deleteMany({ where: { userId } });
      await tx.userProgression.deleteMany({ where: { userId } });
      await tx.challengeResultSnapshot.deleteMany({
        where: {
          OR: [
            { userId },
            ...(createdChallengeIds.length
              ? [{ challengeId: { in: createdChallengeIds } }]
              : [])
          ]
        }
      });
      await tx.challengeReferenceSnapshot.deleteMany({
        where: {
          OR: [
            { createdById: userId },
            ...(createdChallengeIds.length
              ? [{ challengeId: { in: createdChallengeIds } }]
              : [])
          ]
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

    return { deleted: true };
  }
}
