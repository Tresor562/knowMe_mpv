import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStoryAlbumDto,
  CreateStoryDto,
  StoryReactionDto,
  StoryReplyDto,
  StoryViewDto
} from './dto/stories.dto';
import {
  assertStoryContent,
  clampCompletionBps,
  normalizeStoryHashtag,
  resolveStoryExpiry
} from './stories.domain';

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService
  ) {}

  async create(userId: string, dto: CreateStoryDto) {
    assertStoryContentSafe(dto);
    const hasPremiumStories = await this.entitlements.hasAll(userId, ['premium.stories']);
    const expiresAt = resolveStoryExpirySafe({
      durationHours: dto.durationHours,
      permanent: dto.permanent,
      hasPremiumStories
    });
    const audience = dto.audience ?? 'FRIENDS';
    if (audience === 'CUSTOM' && !dto.audienceUserIds?.length) {
      throw storyError('STORY_CUSTOM_AUDIENCE_REQUIRED', 'Select at least one person for a custom Story audience.');
    }

    if (dto.albumId) {
      const album = await this.prisma.storyAlbum.findFirst({
        where: { id: dto.albumId, ownerUserId: userId }
      });
      if (!album) throw storyError('STORY_ALBUM_NOT_FOUND', 'Story album not found.');
    }

    const hashtags = [...new Set((dto.hashtags ?? []).map(normalizeStoryHashtag).filter(Boolean))];
    const mentions = [...new Set(dto.mentionUserIds ?? [])];
    if (mentions.length) {
      const validUsers = await this.prisma.user.count({ where: { id: { in: mentions } } });
      if (validUsers !== mentions.length) {
        throw storyError('STORY_MENTION_TARGET_INVALID', 'One or more mentioned accounts are unavailable.');
      }
    }

    const story = await this.prisma.$transaction(async (tx) => {
      const created = await tx.story.create({
        data: {
          authorUserId: userId,
          type: dto.type as never,
          audience: audience as never,
          caption: dto.caption?.trim() || null,
          captionEntities: dto.captionEntities as Prisma.InputJsonValue | undefined,
          assetId: dto.assetId?.trim() || null,
          thumbnailAssetId: dto.thumbnailAssetId?.trim() || null,
          giftInstanceId: dto.giftInstanceId?.trim() || null,
          gameId: dto.gameId?.trim() || null,
          pollId: dto.pollId?.trim() || null,
          linkUrl: dto.linkUrl?.trim() || null,
          background: dto.background as Prisma.InputJsonValue | undefined,
          musicAssetId: dto.musicAssetId?.trim() || null,
          musicStartMs: dto.musicStartMs ?? null,
          musicDurationMs: dto.musicDurationMs ?? null,
          locationLabel: dto.locationLabel?.trim() || null,
          locationLatitude: dto.locationLatitude ?? null,
          locationLongitude: dto.locationLongitude ?? null,
          albumId: dto.albumId ?? null,
          albumPosition: dto.albumPosition ?? 0,
          allowReplies: dto.allowReplies ?? true,
          allowReactions: dto.allowReactions ?? true,
          allowSharing: dto.allowSharing ?? true,
          allowDownload: dto.allowDownload ?? false,
          sensitive: dto.sensitive ?? false,
          isLive: dto.isLive ?? false,
          expiresAt
        }
      });

      if (audience === 'CUSTOM' && dto.audienceUserIds?.length) {
        await tx.storyAudienceGrant.createMany({
          data: [...new Set(dto.audienceUserIds)].map((targetUserId) => ({
            storyId: created.id,
            targetUserId,
            allowed: true
          })),
          skipDuplicates: true
        });
      }

      if (mentions.length) {
        await tx.storyMention.createMany({
          data: mentions.map((targetUserId) => ({ storyId: created.id, targetUserId })),
          skipDuplicates: true
        });
      }

      if (hashtags.length) {
        await tx.storyHashtag.createMany({
          data: hashtags.map((hashtag) => ({ storyId: created.id, hashtag })),
          skipDuplicates: true
        });
      }

      if (dto.interactiveAreas?.length) {
        await tx.storyInteractiveArea.createMany({
          data: dto.interactiveAreas.map((area, position) => ({
            storyId: created.id,
            type: area.type as never,
            geometry: area.geometry as Prisma.InputJsonValue,
            payload: area.payload as Prisma.InputJsonValue,
            position
          }))
        });
      }

      return created;
    });

    await this.audit.record({
      actorId: userId,
      action: 'STORY_CREATED',
      entity: 'Story',
      entityId: story.id,
      targetAccountId: userId,
      metadata: {
        type: story.type,
        audience: story.audience,
        expiresAt: story.expiresAt?.toISOString() ?? null,
        premiumDuration: Boolean(dto.permanent || (dto.durationHours && dto.durationHours !== 24))
      }
    });

    return this.hydrate(story.id, userId);
  }

  async createBatch(userId: string, stories: CreateStoryDto[]) {
    if (!stories.length) {
      throw storyError('STORY_BATCH_EMPTY', 'Add at least one Story.');
    }
    const result = [];
    for (const story of stories) result.push(await this.create(userId, story));
    return { stories: result };
  }

  async feed(userId: string, cursor?: string) {
    await this.expireDue();
    const now = new Date();
    const [friendships, follows, grants] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }]
        },
        select: { requesterId: true, addresseeId: true }
      }),
      this.prisma.creatorFollow.findMany({
        where: { followerId: userId },
        select: { creatorId: true }
      }),
      this.prisma.storyAudienceGrant.findMany({
        where: { targetUserId: userId, allowed: true },
        select: { storyId: true }
      })
    ]);
    const friendIds = friendships.map((item) =>
      item.requesterId === userId ? item.addresseeId : item.requesterId
    );
    const followedIds = follows.map((item) => item.creatorId);
    const customStoryIds = grants.map((item) => item.storyId);

    const stories = await this.prisma.story.findMany({
      where: {
        status: 'PUBLISHED',
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [
          {
            OR: [
              { authorUserId: userId },
              { audience: 'PUBLIC' },
              { audience: 'FRIENDS', authorUserId: { in: friendIds } },
              { audience: 'FOLLOWERS', authorUserId: { in: followedIds } },
              { audience: 'CUSTOM', id: { in: customStoryIds } }
            ]
          }
        ]
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const page = stories.slice(0, 50);
    return {
      stories: await Promise.all(page.map((story) => this.serialize(story, userId))),
      nextCursor: stories.length > 50 ? page.at(-1)?.id ?? null : null
    };
  }

  async forPublicProfile(username: string) {
    await this.expireDue();
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    if (!user) throw new NotFoundException({ code: 'STORY_PROFILE_NOT_FOUND', message: 'Profile not found.' });
    const now = new Date();
    const stories = await this.prisma.story.findMany({
      where: {
        authorUserId: user.id,
        status: 'PUBLISHED',
        audience: 'PUBLIC',
        startsAt: { lte: now },
        OR: [{ expiresAt: { gt: now } }, { expiresAt: null }, { pinnedAt: { not: null } }]
      },
      orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });
    return {
      profile: user,
      stories: await Promise.all(stories.map((story) => this.serialize(story, null)))
    };
  }

  async get(userId: string, storyId: string) {
    const story = await this.requireVisibleStory(storyId, userId);
    return this.serialize(story, userId);
  }

  async view(userId: string, storyId: string, dto: StoryViewDto) {
    const story = await this.requireVisibleStory(storyId, userId);
    if (story.authorUserId === userId) return { recorded: false, ownerView: true };
    const now = new Date();
    const view = await this.prisma.storyView.upsert({
      where: { storyId_viewerUserId: { storyId, viewerUserId: userId } },
      create: {
        storyId,
        viewerUserId: userId,
        viewedAt: now,
        lastViewedAt: now,
        completionBps: clampCompletionBps(dto.completionBps),
        screenshotAt: dto.screenshot ? now : null
      },
      update: {
        lastViewedAt: now,
        viewCount: { increment: 1 },
        completionBps: clampCompletionBps(dto.completionBps),
        ...(dto.screenshot ? { screenshotAt: now } : {})
      }
    });
    return { recorded: true, view };
  }

  async react(userId: string, storyId: string, dto: StoryReactionDto) {
    const story = await this.requireVisibleStory(storyId, userId);
    if (!story.allowReactions) {
      throw new ForbiddenException({ code: 'STORY_REACTIONS_DISABLED', message: 'Reactions are disabled for this Story.' });
    }
    return this.prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId, userId } },
      create: {
        storyId,
        userId,
        reaction: dto.reaction,
        customEmojiId: dto.customEmojiId?.trim() || null
      },
      update: {
        reaction: dto.reaction,
        customEmojiId: dto.customEmojiId?.trim() || null
      }
    });
  }

  async removeReaction(userId: string, storyId: string) {
    await this.requireVisibleStory(storyId, userId);
    await this.prisma.storyReaction.deleteMany({ where: { storyId, userId } });
    return { removed: true };
  }

  async reply(userId: string, storyId: string, dto: StoryReplyDto) {
    const story = await this.requireVisibleStory(storyId, userId);
    if (!story.allowReplies) {
      throw new ForbiddenException({ code: 'STORY_REPLIES_DISABLED', message: 'Replies are disabled for this Story.' });
    }
    return this.prisma.storyReply.create({
      data: { storyId, authorId: userId, content: dto.content.trim() }
    });
  }

  async archive(userId: string, storyId: string) {
    const story = await this.requireOwnedStory(storyId, userId);
    if (story.status === 'REMOVED') return story;
    return this.prisma.story.update({
      where: { id: storyId },
      data: { status: 'ARCHIVED', archivedAt: new Date() }
    });
  }

  async archiveForMe(userId: string, cursor?: string) {
    await this.expireDue();
    const stories = await this.prisma.story.findMany({
      where: {
        authorUserId: userId,
        OR: [{ status: 'ARCHIVED' }, { status: 'EXPIRED' }]
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    const page = stories.slice(0, 50);
    return {
      stories: await Promise.all(page.map((story) => this.serialize(story, userId))),
      nextCursor: stories.length > 50 ? page.at(-1)?.id ?? null : null
    };
  }

  async pin(userId: string, storyId: string) {
    await this.requireOwnedStory(storyId, userId);
    return this.prisma.story.update({ where: { id: storyId }, data: { pinnedAt: new Date() } });
  }

  async unpin(userId: string, storyId: string) {
    await this.requireOwnedStory(storyId, userId);
    return this.prisma.story.update({ where: { id: storyId }, data: { pinnedAt: null } });
  }

  async remove(userId: string, storyId: string) {
    await this.requireOwnedStory(storyId, userId);
    const removed = await this.prisma.story.update({
      where: { id: storyId },
      data: { status: 'REMOVED', removedAt: new Date() }
    });
    await this.audit.record({
      actorId: userId,
      action: 'STORY_REMOVED',
      entity: 'Story',
      entityId: storyId,
      targetAccountId: userId
    });
    return removed;
  }

  async viewers(userId: string, storyId: string) {
    await this.requireOwnedStory(storyId, userId);
    const [views, reactions, replies] = await Promise.all([
      this.prisma.storyView.findMany({
        where: { storyId },
        orderBy: { lastViewedAt: 'desc' },
        take: 500
      }),
      this.prisma.storyReaction.findMany({ where: { storyId } }),
      this.prisma.storyReply.count({ where: { storyId, deletedAt: null } })
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: views.map((view) => view.viewerUserId) } },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    return {
      uniqueViewers: views.length,
      totalViews: views.reduce((sum, view) => sum + view.viewCount, 0),
      replies,
      reactions: reactions.length,
      averageCompletionBps: views.length
        ? Math.round(views.reduce((sum, view) => sum + view.completionBps, 0) / views.length)
        : 0,
      screenshots: views.filter((view) => view.screenshotAt).length,
      viewers: views.map((view) => ({ ...view, user: userMap.get(view.viewerUserId) ?? null }))
    };
  }

  async createAlbum(userId: string, dto: CreateStoryAlbumDto) {
    return this.prisma.storyAlbum.create({
      data: {
        ownerUserId: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        coverAssetId: dto.coverAssetId?.trim() || null,
        audience: (dto.audience ?? 'PUBLIC') as never
      }
    });
  }

  async repost(userId: string, storyId: string, durationHours?: number) {
    const source = await this.requireVisibleStory(storyId, userId);
    if (!source.allowSharing) {
      throw new ForbiddenException({ code: 'STORY_SHARING_DISABLED', message: 'Sharing is disabled for this Story.' });
    }
    return this.create(userId, {
      type: source.type,
      audience: 'FRIENDS',
      caption: source.caption ?? undefined,
      assetId: source.assetId ?? undefined,
      thumbnailAssetId: source.thumbnailAssetId ?? undefined,
      giftInstanceId: source.giftInstanceId ?? undefined,
      gameId: source.gameId ?? undefined,
      pollId: source.pollId ?? undefined,
      linkUrl: source.linkUrl ?? undefined,
      background: (source.background as Record<string, unknown> | null) ?? undefined,
      musicAssetId: source.musicAssetId ?? undefined,
      musicStartMs: source.musicStartMs ?? undefined,
      musicDurationMs: source.musicDurationMs ?? undefined,
      durationHours: durationHours ?? 24
    }).then(async (created) => {
      await this.prisma.story.update({ where: { id: created.id }, data: { repostOfId: storyId } });
      return this.hydrate(created.id, userId);
    });
  }

  private async hydrate(storyId: string, viewerId: string | null) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException({ code: 'STORY_NOT_FOUND', message: 'Story not found.' });
    return this.serialize(story, viewerId);
  }

  private async serialize(story: any, viewerId: string | null) {
    const [author, mentions, hashtags, areas, reactionCount, replyCount, viewerReaction] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: story.authorUserId },
        select: { id: true, username: true, displayName: true, avatarUrl: true }
      }),
      this.prisma.storyMention.findMany({ where: { storyId: story.id } }),
      this.prisma.storyHashtag.findMany({ where: { storyId: story.id } }),
      this.prisma.storyInteractiveArea.findMany({ where: { storyId: story.id }, orderBy: { position: 'asc' } }),
      this.prisma.storyReaction.count({ where: { storyId: story.id } }),
      this.prisma.storyReply.count({ where: { storyId: story.id, deletedAt: null } }),
      viewerId
        ? this.prisma.storyReaction.findUnique({ where: { storyId_userId: { storyId: story.id, userId: viewerId } } })
        : null
    ]);
    return {
      ...story,
      author,
      mentions,
      hashtags: hashtags.map((item) => item.hashtag),
      interactiveAreas: areas,
      metrics: { reactions: reactionCount, replies: replyCount },
      viewer: { own: viewerId === story.authorUserId, reaction: viewerReaction }
    };
  }

  private async requireOwnedStory(storyId: string, userId: string) {
    const story = await this.prisma.story.findFirst({ where: { id: storyId, authorUserId: userId } });
    if (!story) throw new NotFoundException({ code: 'STORY_NOT_FOUND', message: 'Story not found.' });
    return story;
  }

  private async requireVisibleStory(storyId: string, viewerId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.status === 'REMOVED' || story.status === 'DRAFT') {
      throw new NotFoundException({ code: 'STORY_NOT_FOUND', message: 'Story not found.' });
    }
    if (story.authorUserId === viewerId) return story;
    const now = new Date();
    if (story.startsAt > now || (story.expiresAt && story.expiresAt <= now && !story.pinnedAt)) {
      throw new NotFoundException({ code: 'STORY_NOT_FOUND', message: 'Story not found.' });
    }
    if (story.audience === 'PUBLIC') return story;
    if (story.audience === 'PRIVATE') throw new ForbiddenException({ code: 'STORY_AUDIENCE_DENIED', message: 'This Story is private.' });
    if (story.audience === 'CUSTOM' || story.audience === 'BEST_FRIENDS') {
      const grant = await this.prisma.storyAudienceGrant.findUnique({
        where: { storyId_targetUserId: { storyId, targetUserId: viewerId } }
      });
      if (grant?.allowed) return story;
      throw new ForbiddenException({ code: 'STORY_AUDIENCE_DENIED', message: 'This Story is not available to you.' });
    }
    if (story.audience === 'FRIENDS') {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: story.authorUserId, addresseeId: viewerId },
            { requesterId: viewerId, addresseeId: story.authorUserId }
          ]
        },
        select: { id: true }
      });
      if (friendship) return story;
    }
    if (story.audience === 'FOLLOWERS') {
      const follow = await this.prisma.creatorFollow.findUnique({
        where: { creatorId_followerId: { creatorId: story.authorUserId, followerId: viewerId } }
      });
      if (follow) return story;
    }
    throw new ForbiddenException({ code: 'STORY_AUDIENCE_DENIED', message: 'This Story is not available to you.' });
  }

  private async expireDue() {
    const now = new Date();
    await this.prisma.story.updateMany({
      where: { status: 'PUBLISHED', expiresAt: { lte: now }, pinnedAt: null },
      data: { status: 'EXPIRED', archivedAt: now }
    });
  }
}

function assertStoryContentSafe(dto: CreateStoryDto) {
  try {
    assertStoryContent(dto);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STORY_INVALID';
    const messages: Record<string, string> = {
      STORY_CONTENT_REQUIRED: 'Add text, media or another Story object before publishing.',
      STORY_MEDIA_REQUIRED: 'This Story type requires media.',
      STORY_GIFT_REQUIRED: 'This Story type requires a gift.',
      STORY_GAME_REQUIRED: 'This Story type requires a game.',
      STORY_POLL_REQUIRED: 'This Story type requires a poll.',
      STORY_LINK_REQUIRED: 'This Story type requires a link.'
    };
    throw storyError(code, messages[code] ?? 'Invalid Story.');
  }
}

function resolveStoryExpirySafe(input: Parameters<typeof resolveStoryExpiry>[0]) {
  try {
    return resolveStoryExpiry(input);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STORY_DURATION_NOT_ALLOWED';
    if (code === 'STORY_PREMIUM_REQUIRED') {
      throw storyError(code, 'KnowMe Premium is required for this Story duration.');
    }
    throw storyError(code, 'This Story duration is not available.');
  }
}

function storyError(code: string, message: string) {
  return new BadRequestException({ code, message });
}
