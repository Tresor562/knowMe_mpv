import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WEEKLY_RANKING_XP_CAP = 500;
const LEADERBOARD_LIMIT = 50;
const PARTICIPANT_SCAN_LIMIT = 5000;

@Injectable()
export class LeaderboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async weekly(requesterId: string, now = new Date()) {
    const window = this.weekWindow(now);
    const [requesterPreference, requesterPrivacy, enabledPreferences] =
      await Promise.all([
        this.prisma.leaderboardPreference.findUnique({
          where: { userId: requesterId }
        }),
        this.prisma.privacyPreference.findUnique({
          where: { userId: requesterId }
        }),
        this.prisma.leaderboardPreference.findMany({
          where: {
            weeklyXpEnabled: true,
            displayAlias: { not: null }
          },
          orderBy: [{ optedInAt: 'asc' }, { userId: 'asc' }],
          take: PARTICIPANT_SCAN_LIMIT
        })
      ]);

    const candidateIds = enabledPreferences.map((preference) => preference.userId);
    const discoverable = candidateIds.length
      ? await this.prisma.privacyPreference.findMany({
          where: {
            userId: { in: candidateIds },
            discoverability: true
          },
          select: { userId: true }
        })
      : [];
    const discoverableIds = new Set(discoverable.map((item) => item.userId));
    const eligiblePreferences = enabledPreferences.filter(
      (preference) =>
        Boolean(preference.displayAlias) && discoverableIds.has(preference.userId)
    );
    const eligibleIds = eligiblePreferences.map((preference) => preference.userId);
    const aggregates = eligibleIds.length
      ? await this.prisma.xpLedgerEntry.groupBy({
          by: ['userId'],
          where: {
            userId: { in: eligibleIds },
            createdAt: { gte: window.start, lt: window.end }
          },
          _sum: { amount: true }
        })
      : [];
    const xpByUser = new Map(
      aggregates.map((aggregate) => [aggregate.userId, aggregate._sum.amount ?? 0])
    );

    const ranked = eligiblePreferences
      .map((preference) => ({
        userId: preference.userId,
        alias: preference.displayAlias!,
        weeklyXp: Math.max(0, xpByUser.get(preference.userId) ?? 0),
        rankingXp: this.rankingScore(xpByUser.get(preference.userId) ?? 0),
        capped:
          Math.max(0, xpByUser.get(preference.userId) ?? 0) >
          WEEKLY_RANKING_XP_CAP,
        optedInAt: preference.optedInAt
      }))
      .filter((entry) => entry.rankingXp > 0)
      .sort((left, right) => {
        if (right.rankingXp !== left.rankingXp) {
          return right.rankingXp - left.rankingXp;
        }
        const leftTime = left.optedInAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightTime = right.optedInAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (leftTime !== rightTime) return leftTime - rightTime;
        const aliasOrder = left.alias.localeCompare(right.alias, 'fr');
        return aliasOrder || left.userId.localeCompare(right.userId);
      });

    let previousScore: number | null = null;
    let previousRank = 0;
    const rankedWithPositions = ranked.map((entry, index) => {
      const rank = entry.rankingXp === previousScore ? previousRank : index + 1;
      previousScore = entry.rankingXp;
      previousRank = rank;
      return { ...entry, rank };
    });
    const requesterEntry = rankedWithPositions.find(
      (entry) => entry.userId === requesterId
    );

    return {
      window,
      entries: rankedWithPositions.slice(0, LEADERBOARD_LIMIT).map((entry) => ({
        rank: entry.rank,
        alias: entry.alias,
        weeklyXp: entry.weeklyXp,
        rankingXp: entry.rankingXp,
        capped: entry.capped,
        isSelf: entry.userId === requesterId
      })),
      self: this.selfStatus(
        requesterId,
        requesterPreference,
        requesterPrivacy?.discoverability === true,
        requesterEntry
      ),
      preference: this.publicPreference(requesterPreference),
      rules: {
        timezone: 'UTC',
        weekStartsOn: 'MONDAY',
        optInRequired: true,
        discoverabilityRequired: true,
        maximumVisibleEntries: LEADERBOARD_LIMIT,
        weeklyRankingXpCap: WEEKLY_RANKING_XP_CAP,
        participantScanLimit: PARTICIPANT_SCAN_LIMIT,
        rewards: null,
        paidBoostsAllowed: false,
        scoreSource: 'IMMUTABLE_XP_LEDGER'
      }
    };
  }

  async setWeeklyPreference(
    userId: string,
    enabled: boolean,
    displayAlias?: string
  ) {
    const alias = displayAlias?.trim();
    if (enabled && !alias) {
      throw new BadRequestException(
        'Un pseudonyme public est requis pour rejoindre le classement.'
      );
    }

    const existing = await this.prisma.leaderboardPreference.findUnique({
      where: { userId }
    });
    const nextAlias = enabled ? alias! : existing?.displayAlias ?? alias ?? null;
    if (
      existing &&
      existing.weeklyXpEnabled === enabled &&
      existing.displayAlias === nextAlias
    ) {
      return { replayed: true, preference: this.publicPreference(existing) };
    }

    const now = new Date();
    const preference = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.leaderboardPreference.upsert({
        where: { userId },
        create: {
          userId,
          weeklyXpEnabled: enabled,
          displayAlias: nextAlias,
          optedInAt: enabled ? now : null,
          optedOutAt: enabled ? null : now
        },
        update: {
          weeklyXpEnabled: enabled,
          displayAlias: nextAlias,
          optedInAt: enabled ? existing?.optedInAt ?? now : existing?.optedInAt,
          optedOutAt: enabled ? null : now
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: enabled ? 'LEADERBOARD_WEEKLY_OPT_IN' : 'LEADERBOARD_WEEKLY_OPT_OUT',
          entity: 'LeaderboardPreference',
          entityId: userId,
          targetAccountId: userId,
          metadata: {
            displayAlias: nextAlias,
            weeklyRankingXpCap: WEEKLY_RANKING_XP_CAP
          }
        }
      });
      return saved;
    });

    return { replayed: false, preference: this.publicPreference(preference) };
  }

  async exportForAccount(userId: string) {
    return this.prisma.leaderboardPreference.findUnique({ where: { userId } });
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.leaderboardPreference.deleteMany({ where: { userId } });
  }

  weekWindow(value: Date) {
    const dayOffset = (value.getUTCDay() + 6) % 7;
    const start = new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate() - dayOffset
      )
    );
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  rankingScore(totalXp: number) {
    const safeXp = Math.max(0, Math.floor(totalXp));
    return Math.min(safeXp, WEEKLY_RANKING_XP_CAP);
  }

  private selfStatus(
    requesterId: string,
    preference: {
      weeklyXpEnabled: boolean;
      displayAlias: string | null;
    } | null,
    discoverable: boolean,
    ranked?: {
      userId: string;
      alias: string;
      weeklyXp: number;
      rankingXp: number;
      capped: boolean;
      rank: number;
    }
  ) {
    if (!preference?.weeklyXpEnabled) {
      return {
        eligible: false,
        reasonCode: 'OPT_IN_REQUIRED',
        rank: null,
        weeklyXp: 0,
        rankingXp: 0
      };
    }
    if (!discoverable) {
      return {
        eligible: false,
        reasonCode: 'DISCOVERABILITY_DISABLED',
        rank: null,
        weeklyXp: 0,
        rankingXp: 0
      };
    }
    return {
      eligible: true,
      reasonCode: ranked ? 'RANKED' : 'NO_WEEKLY_XP',
      rank: ranked?.rank ?? null,
      alias: preference.displayAlias,
      weeklyXp: ranked?.weeklyXp ?? 0,
      rankingXp: ranked?.rankingXp ?? 0,
      capped: ranked?.capped ?? false,
      isSelf: ranked?.userId === requesterId
    };
  }

  private publicPreference(
    preference: {
      weeklyXpEnabled: boolean;
      displayAlias: string | null;
      optedInAt?: Date | null;
      optedOutAt?: Date | null;
      updatedAt?: Date;
    } | null
  ) {
    return preference
      ? {
          enabled: preference.weeklyXpEnabled,
          displayAlias: preference.displayAlias,
          optedInAt: preference.optedInAt ?? null,
          optedOutAt: preference.optedOutAt ?? null,
          updatedAt: preference.updatedAt ?? null
        }
      : {
          enabled: false,
          displayAlias: null,
          optedInAt: null,
          optedOutAt: null,
          updatedAt: null
        };
  }
}
