import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UniversalSearchKind = 'MESSAGE' | 'POST' | 'CHALLENGE' | 'CONVERSATION';

type SearchItem = {
  kind: UniversalSearchKind;
  id: string;
  title: string | null;
  snippet: string;
  route: string;
  updatedAt: Date;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, rawQuery: string, rawLimit = 20) {
    const query = rawQuery.trim();
    if (query.length < 2) {
      return { query, items: [], nextCursor: null };
    }

    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const take = Math.min(limit + 1, 51);
    const contains = { contains: query, mode: 'insensitive' as const };

    const [messages, posts, challenges, conversations] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          content: contains,
          conversation: { members: { some: { userId } } }
        },
        select: {
          id: true,
          conversationId: true,
          content: true,
          createdAt: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take
      }),
      this.prisma.post.findMany({
        where: { authorId: userId, content: contains },
        select: { id: true, content: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take
      }),
      this.prisma.challenge.findMany({
        where: {
          creatorId: userId,
          OR: [{ title: contains }, { description: contains }]
        },
        select: {
          id: true,
          title: true,
          description: true,
          updatedAt: true
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take
      }),
      this.prisma.conversation.findMany({
        where: {
          title: contains,
          members: { some: { userId } }
        },
        select: { id: true, title: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take
      })
    ]);

    const items: SearchItem[] = [
      ...messages.map((message) => ({
        kind: 'MESSAGE' as const,
        id: message.id,
        title: null,
        snippet: this.snippet(message.content, query),
        route: `/messages/${message.conversationId}?message=${message.id}`,
        updatedAt: message.createdAt
      })),
      ...posts.map((post) => ({
        kind: 'POST' as const,
        id: post.id,
        title: null,
        snippet: this.snippet(post.content, query),
        route: `/posts/${post.id}`,
        updatedAt: post.updatedAt
      })),
      ...challenges.map((challenge) => ({
        kind: 'CHALLENGE' as const,
        id: challenge.id,
        title: challenge.title,
        snippet: this.snippet(
          challenge.description ?? challenge.title,
          query
        ),
        route: `/challenges/${challenge.id}`,
        updatedAt: challenge.updatedAt
      })),
      ...conversations.map((conversation) => ({
        kind: 'CONVERSATION' as const,
        id: conversation.id,
        title: conversation.title,
        snippet: conversation.title ?? '',
        route: `/messages/${conversation.id}`,
        updatedAt: conversation.updatedAt
      }))
    ].sort((a, b) => {
      const delta = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (delta) return delta;
      return `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`);
    });

    const page = items.slice(0, limit);
    return {
      query,
      items: page.map(({ updatedAt, ...item }) => ({
        ...item,
        updatedAt: updatedAt.toISOString()
      })),
      nextCursor: items.length > limit
        ? `${page[page.length - 1]?.kind}:${page[page.length - 1]?.id}`
        : null
    };
  }

  private snippet(content: string, query: string) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 180) return normalized;
    const index = normalized.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    const start = Math.max(0, index - 60);
    const end = Math.min(normalized.length, start + 180);
    return `${start > 0 ? '…' : ''}${normalized.slice(start, end)}${end < normalized.length ? '…' : ''}`;
  }
}
