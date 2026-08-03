import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PinCreatorPostDto } from './dto/pin-creator-post.dto';
import { UpsertCreatorProfileDto } from './dto/upsert-creator-profile.dto';

type CreatorRecord = {
  userId: string;
  slug: string;
  title: string;
  bio: string | null;
  category: string;
  visibility: string;
  status: string;
  followerCount: number;
  version: number;
  activatedAt: Date;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CreatorsService {
  private readonly metricHashSecret =
    process.env.CREATOR_METRICS_HASH_SECRET ??
    process.env.JWT_SECRET ??
    'knowme-development-creator-metrics';

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async mine(userId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    return profile ? this.serialize(profile) : null;
  }

  async upsert(userId: string, dto: UpsertCreatorProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuspended: true }
    });
    if (!user || user.isSuspended) {
      throw new ForbiddenException('Ce compte ne peut pas activer le mode créateur.');
    }

    let record: CreatorRecord;
    try {
      record = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.creatorProfile.findUnique({ where: { userId } });
          if (current?.status === 'SUSPENDED') {
            throw new ForbiddenException('Ce profil créateur est suspendu.');
          }
          if ((current?.version ?? 0) !== dto.expectedVersion) {
            throw this.versionConflict(current);
          }

          const slugOwner = await tx.creatorProfile.findUnique({
            where: { slug: dto.slug }
          });
          if (slugOwner && slugOwner.userId !== userId) {
            throw new ConflictException({
              code: 'CREATOR_SLUG_TAKEN',
              message: 'Cet identifiant créateur est déjà utilisé.'
            });
          }

          if (!current) {
            return tx.creatorProfile.create({
              data: {
                userId,
                slug: dto.slug,
                title: dto.title.trim(),
                bio: dto.bio?.trim() || null,
                category: dto.category,
                visibility: dto.visibility,
                status: dto.status,
                version: 1
              }
            });
          }

          const changed = await tx.creatorProfile.updateMany({
            where: { userId, version: dto.expectedVersion },
            data: {
              slug: dto.slug,
              title: dto.title.trim(),
              bio: dto.bio?.trim() || null,
              category: dto.category,
              visibility: dto.visibility,
              status: dto.status,
              version: { increment: 1 }
            }
          });
          if (changed.count !== 1) {
            throw this.versionConflict(
              await tx.creatorProfile.findUnique({ where: { userId } })
            );
          }
          return tx.creatorProfile.findUniqueOrThrow({ where: { userId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        const current = await this.prisma.creatorProfile.findUnique({ where: { userId } });
        throw this.versionConflict(current);
      }
      throw error;
    }

    await this.audit.record({
      actorId: userId,
      action: 'CREATOR_PROFILE_UPDATED',
      entity: 'CreatorProfile',
      entityId: userId,
      metadata: {
        slug: record.slug,
        category: record.category,
        visibility: record.visibility,
        status: record.status,
        version: record.version
      }
    });
    return this.serialize(record);
  }

  async publicProfile(slug: string, viewerId?: string) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { slug } });
    if (!profile || profile.status !== 'ACTIVE') {
      throw new NotFoundException('Profil créateur introuvable.');
    }
    const [user, pins, posts, following] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: profile.userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          createdAt: true,
          isSuspended: true
        }
      }),
      this.prisma.creatorPinnedPost.findMany({
        where: { creatorId: profile.userId },
        orderBy: { position: 'asc' }
      }),
      this.prisma.post.findMany({
        where: { authorId: profile.userId },
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { _count: { select: { likes: true, comments: true } } }
      }),
      viewerId
        ? this.prisma.creatorFollow.findUnique({
            where: {
              creatorId_followerId: {
                creatorId: profile.userId,
                followerId: viewerId
              }
            }
          })
        : null
    ]);
    if (!user || user.isSuspended) {
      throw new NotFoundException('Profil créateur introuvable.');
    }
    const byId = new Map(posts.map((post) => [post.id, post]));
    return {
      ...this.serialize(profile),
      owner: user,
      isFollowing: Boolean(following),
      isOwner: viewerId === profile.userId,
      pinnedPosts: pins
        .map((pin) => byId.get(pin.postId))
        .filter((post): post is NonNullable<typeof post> => Boolean(post)),
      recentPosts: posts.filter((post) => !pins.some((pin) => pin.postId === post.id))
    };
  }

  async follow(followerId: string, slug: string) {
    const profile = await this.activeBySlug(slug);
    if (profile.userId === followerId) {
      throw new ForbiddenException('Tu ne peux pas suivre ton propre profil créateur.');
    }
    const actor = await this.prisma.user.findUnique({
      where: { id: followerId },
      select: { displayName: true, isSuspended: true }
    });
    if (!actor || actor.isSuspended) throw new ForbiddenException('Action refusée.');

    const created = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.creatorFollow.findUnique({
          where: {
            creatorId_followerId: { creatorId: profile.userId, followerId }
          }
        });
        if (existing) return false;
        await tx.creatorFollow.create({ data: { creatorId: profile.userId, followerId } });
        await tx.creatorProfile.update({
          where: { userId: profile.userId },
          data: { followerCount: { increment: 1 } }
        });
        await this.incrementDaily(tx, profile.userId, { followsGained: 1 });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (created) {
      await this.notifications.create({
        userId: profile.userId,
        type: 'CREATOR_FOLLOWED',
        title: 'Nouvel abonnement',
        body: `${actor.displayName} suit maintenant ton profil créateur.`,
        data: {
          route: `/creator/${profile.slug}`,
          entityType: 'CREATOR_PROFILE',
          entityId: profile.userId,
          actorId: followerId
        }
      });
    }
    return { following: true, replayed: !created };
  }

  async unfollow(followerId: string, slug: string) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { slug } });
    if (!profile) return { following: false, replayed: true };
    const removed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.creatorFollow.deleteMany({
        where: { creatorId: profile.userId, followerId }
      });
      if (!result.count) return false;
      await tx.creatorProfile.updateMany({
        where: { userId: profile.userId, followerCount: { gt: 0 } },
        data: { followerCount: { decrement: 1 } }
      });
      await this.incrementDaily(tx, profile.userId, { unfollows: 1 });
      return true;
    });
    return { following: false, replayed: !removed };
  }

  async recordProfileView(viewerId: string, slug: string) {
    const profile = await this.activeBySlug(slug);
    if (profile.userId === viewerId) return { counted: false, reason: 'OWNER' };
    return this.recordUniqueMetric(profile.userId, viewerId, 'PROFILE_VIEW');
  }

  async recordPostView(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true }
    });
    if (!post) throw new NotFoundException('Publication introuvable.');
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: post.authorId }
    });
    if (!profile || profile.status !== 'ACTIVE') return { counted: false, reason: 'NOT_CREATOR' };
    if (post.authorId === viewerId) return { counted: false, reason: 'OWNER' };
    return this.recordUniqueMetric(post.authorId, viewerId, 'POST_VIEW');
  }

  async pinPost(userId: string, postId: string, dto: PinCreatorPostDto) {
    await this.assertOwnedActiveProfile(userId);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true }
    });
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException('Seules tes publications peuvent être épinglées.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.creatorPinnedPost.deleteMany({
        where: { creatorId: userId, position: dto.position, NOT: { postId } }
      });
      await tx.creatorPinnedPost.upsert({
        where: { creatorId_postId: { creatorId: userId, postId } },
        create: { creatorId: userId, postId, position: dto.position },
        update: { position: dto.position }
      });
    });
    return { pinned: true, postId, position: dto.position };
  }

  async unpinPost(userId: string, postId: string) {
    await this.prisma.creatorPinnedPost.deleteMany({
      where: { creatorId: userId, postId }
    });
    return { pinned: false, postId };
  }

  async dashboard(userId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil créateur introuvable.');
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 29);
    since.setUTCHours(0, 0, 0, 0);
    const [metrics, postCount, likeCount, commentCount, pins] = await Promise.all([
      this.prisma.creatorMetricDaily.findMany({
        where: { creatorId: userId, metricDate: { gte: since } },
        orderBy: { metricDate: 'asc' }
      }),
      this.prisma.post.count({ where: { authorId: userId } }),
      this.prisma.postLike.count({ where: { post: { authorId: userId } } }),
      this.prisma.postComment.count({ where: { post: { authorId: userId } } }),
      this.prisma.creatorPinnedPost.findMany({
        where: { creatorId: userId },
        orderBy: { position: 'asc' }
      })
    ]);
    return {
      profile: this.serialize(profile),
      windowDays: 30,
      metrics,
      totals: {
        followers: profile.followerCount,
        posts: postCount,
        likes: likeCount,
        comments: commentCount,
        profileViews: metrics.reduce((sum, item) => sum + item.profileViews, 0),
        postViews: metrics.reduce((sum, item) => sum + item.postViews, 0),
        followsGained: metrics.reduce((sum, item) => sum + item.followsGained, 0),
        unfollows: metrics.reduce((sum, item) => sum + item.unfollows, 0)
      },
      pins,
      privacy: {
        uniqueAuthenticatedViewsOnly: true,
        rawViewerIdsStored: false,
        receiptRetentionDays: 35
      }
    };
  }

  async govern(
    actorId: string,
    userId: string,
    suspended: boolean,
    reason?: string
  ) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil créateur introuvable.');
    if (suspended && (!reason || reason.trim().length < 5)) {
      throw new ConflictException('Une raison de suspension est requise.');
    }
    const updated = await this.prisma.creatorProfile.update({
      where: { userId },
      data: suspended
        ? {
            status: 'SUSPENDED',
            suspendedAt: new Date(),
            suspensionReason: reason?.trim(),
            version: { increment: 1 }
          }
        : {
            status: 'PAUSED',
            suspendedAt: null,
            suspensionReason: null,
            version: { increment: 1 }
          }
    });
    await this.audit.record({
      actorId,
      action: suspended ? 'CREATOR_PROFILE_SUSPENDED' : 'CREATOR_PROFILE_RESTORED',
      entity: 'CreatorProfile',
      entityId: userId,
      metadata: { reason: reason?.trim() ?? null, version: updated.version }
    });
    return this.serialize(updated);
  }

  async exportForAccount(userId: string) {
    const [profile, following, followers, pins, metrics] = await Promise.all([
      this.prisma.creatorProfile.findUnique({ where: { userId } }),
      this.prisma.creatorFollow.findMany({ where: { followerId: userId } }),
      this.prisma.creatorFollow.findMany({ where: { creatorId: userId } }),
      this.prisma.creatorPinnedPost.findMany({ where: { creatorId: userId } }),
      this.prisma.creatorMetricDaily.findMany({ where: { creatorId: userId } })
    ]);
    return {
      formatVersion: 1,
      profile,
      following,
      followers,
      pins,
      metrics,
      audienceReceiptHashesIncluded: false,
      monetizationIncluded: false
    };
  }

  async deleteForAccount(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    await tx.creatorAudienceReceipt.deleteMany({ where: { creatorId: userId } });
    await tx.creatorMetricDaily.deleteMany({ where: { creatorId: userId } });
    await tx.creatorPinnedPost.deleteMany({ where: { creatorId: userId } });
    const affectedCreators = await tx.creatorFollow.groupBy({
      by: ['creatorId'],
      where: { followerId: userId },
      _count: { _all: true }
    });
    await tx.creatorFollow.deleteMany({
      where: { OR: [{ creatorId: userId }, { followerId: userId }] }
    });
    for (const affected of affectedCreators) {
      if (affected.creatorId === userId) continue;
      await tx.creatorProfile.updateMany({
        where: {
          userId: affected.creatorId,
          followerCount: { gte: affected._count._all }
        },
        data: { followerCount: { decrement: affected._count._all } }
      });
    }
    await tx.creatorProfile.deleteMany({ where: { userId } });
  }

  private async activeBySlug(slug: string) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { slug } });
    if (!profile || profile.status !== 'ACTIVE') {
      throw new NotFoundException('Profil créateur introuvable.');
    }
    return profile;
  }

  private async assertOwnedActiveProfile(userId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile || profile.status === 'SUSPENDED') {
      throw new ForbiddenException('Profil créateur actif requis.');
    }
    return profile;
  }

  private async recordUniqueMetric(
    creatorId: string,
    viewerId: string,
    kind: 'PROFILE_VIEW' | 'POST_VIEW'
  ) {
    const day = this.utcDay(new Date());
    const subjectHash = createHmac('sha256', this.metricHashSecret)
      .update(`${day.toISOString()}:${viewerId}`)
      .digest('hex');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.creatorAudienceReceipt.create({
          data: {
            creatorId,
            metricKind: kind,
            subjectHash,
            metricDate: day,
            expiresAt: new Date(day.getTime() + 35 * 86_400_000)
          }
        });
        await this.incrementDaily(
          tx,
          creatorId,
          kind === 'PROFILE_VIEW' ? { profileViews: 1 } : { postViews: 1 }
        );
      });
      return { counted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { counted: false, reason: 'ALREADY_COUNTED_TODAY' };
      }
      throw error;
    }
  }

  private incrementDaily(
    tx: Prisma.TransactionClient,
    creatorId: string,
    increment: {
      profileViews?: number;
      postViews?: number;
      followsGained?: number;
      unfollows?: number;
    }
  ) {
    const metricDate = this.utcDay(new Date());
    return tx.creatorMetricDaily.upsert({
      where: { creatorId_metricDate: { creatorId, metricDate } },
      create: { creatorId, metricDate, ...increment },
      update: {
        ...(increment.profileViews
          ? { profileViews: { increment: increment.profileViews } }
          : {}),
        ...(increment.postViews
          ? { postViews: { increment: increment.postViews } }
          : {}),
        ...(increment.followsGained
          ? { followsGained: { increment: increment.followsGained } }
          : {}),
        ...(increment.unfollows
          ? { unfollows: { increment: increment.unfollows } }
          : {})
      }
    });
  }

  private utcDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private serialize(record: CreatorRecord) {
    return {
      userId: record.userId,
      slug: record.slug,
      title: record.title,
      bio: record.bio,
      category: record.category,
      visibility: record.visibility,
      status: record.status,
      followerCount: record.followerCount,
      version: record.version,
      activatedAt: record.activatedAt,
      suspendedAt: record.suspendedAt,
      suspensionReason: record.suspensionReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      staffRoleGranted: false,
      verificationGranted: false,
      premiumGranted: false
    };
  }

  private versionConflict(current: CreatorRecord | null) {
    return new ConflictException({
      code: 'CREATOR_VERSION_CONFLICT',
      message: 'Le profil créateur a changé sur un autre appareil.',
      details: {
        currentVersion: current?.version ?? 0,
        currentSlug: current?.slug ?? null
      }
    });
  }
}
