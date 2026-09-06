import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeStoryHashtag } from './stories.domain';

@Injectable()
export class StoryDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async discover(input: { hashtag?: string; location?: string; cursor?: string }) {
    const now = new Date();
    const hashtag = input.hashtag ? normalizeStoryHashtag(input.hashtag) : null;
    const location = input.location?.trim().slice(0, 160) || null;

    const hashtagRows = hashtag
      ? await this.prisma.storyHashtag.findMany({
          where: { hashtag },
          select: { storyId: true },
          take: 500
        })
      : [];

    const stories = await this.prisma.story.findMany({
      where: {
        ownerType: 'PROFILE',
        status: 'PUBLISHED',
        audience: 'PUBLIC',
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(hashtag ? { id: { in: hashtagRows.map((row) => row.storyId) } } : {}),
        ...(location
          ? { locationLabel: { contains: location, mode: 'insensitive' } }
          : {})
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });

    const page = stories.slice(0, 30);
    const authorIds = [...new Set(page.map((story) => story.authorUserId))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    return {
      filters: { hashtag, location },
      stories: page.map((story) => ({ ...story, author: authorMap.get(story.authorUserId) ?? null })),
      nextCursor: stories.length > 30 ? page.at(-1)?.id ?? null : null
    };
  }

  async trendingHashtags() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.storyHashtag.groupBy({
      by: ['hashtag'],
      where: { createdAt: { gte: since } },
      _count: { hashtag: true },
      orderBy: { _count: { hashtag: 'desc' } },
      take: 30
    });
    return rows.map((row) => ({ hashtag: row.hashtag, stories24h: row._count.hashtag }));
  }
}
