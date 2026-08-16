import { BadRequestException, Injectable } from '@nestjs/common';
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

type SearchCursor = {
  v: 1;
  q: string;
  t: string;
  k: UniversalSearchKind;
  id: string;
};

const SEARCH_KINDS: UniversalSearchKind[] = [
  'MESSAGE',
  'POST',
  'CHALLENGE',
  'CONVERSATION'
];

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, rawQuery: string, rawLimit = 20, rawCursor?: string) {
    const query = rawQuery.trim();
    if (query.length < 2) {
      return { query, items: [], nextCursor: null };
    }

    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const take = Math.min(limit + 1, 51);
    const normalizedQuery = query.toLocaleLowerCase();
    const cursor = rawCursor ? this.decodeCursor(rawCursor, normalizedQuery) : null;
    const contains = { contains: query, mode: 'insensitive' as const };

    const messageBoundary = this.boundary('MESSAGE', 'createdAt', cursor);
    const postBoundary = this.boundary('POST', 'updatedAt', cursor);
    const challengeBoundary = this.boundary('CHALLENGE', 'updatedAt', cursor);
    const conversationBoundary = this.boundary('CONVERSATION', 'updatedAt', cursor);

    const [messages, posts, challenges, conversations] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          content: contains,
          conversation: { members: { some: { userId } } },
          ...(messageBoundary ? { AND: [messageBoundary] } : {})
        },
        select: {
          id: true,
          conversationId: true,
          content: true,
          createdAt: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take
      }),
      this.prisma.post.findMany({
        where: {
          authorId: userId,
          content: contains,
          ...(postBoundary ? { AND: [postBoundary] } : {})
        },
        select: { id: true, content: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take
      }),
      this.prisma.challenge.findMany({
        where: {
          creatorId: userId,
          AND: [
            { OR: [{ title: contains }, { description: contains }] },
            ...(challengeBoundary ? [challengeBoundary] : [])
          ]
        },
        select: {
          id: true,
          title: true,
          description: true,
          updatedAt: true
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take
      }),
      this.prisma.conversation.findMany({
        where: {
          title: contains,
          members: { some: { userId } },
          ...(conversationBoundary ? { AND: [conversationBoundary] } : {})
        },
        select: { id: true, title: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
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
        snippet: this.snippet(challenge.description ?? challenge.title, query),
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
    const last = page[page.length - 1];
    return {
      query,
      items: page.map(({ updatedAt, ...item }) => ({
        ...item,
        updatedAt: updatedAt.toISOString()
      })),
      nextCursor:
        items.length > limit && last
          ? this.encodeCursor({
              v: 1,
              q: normalizedQuery,
              t: last.updatedAt.toISOString(),
              k: last.kind,
              id: last.id
            })
          : null
    };
  }

  private boundary(kind: UniversalSearchKind, field: 'createdAt' | 'updatedAt', cursor: SearchCursor | null) {
    if (!cursor) return null;
    const timestamp = new Date(cursor.t);
    const sameTimestamp: Record<string, unknown>[] = [];
    const kindDelta = kind.localeCompare(cursor.k);
    if (kindDelta > 0) {
      sameTimestamp.push({ [field]: timestamp });
    } else if (kindDelta === 0) {
      sameTimestamp.push({ [field]: timestamp, id: { gt: cursor.id } });
    }
    return {
      OR: [{ [field]: { lt: timestamp } }, ...sameTimestamp]
    };
  }

  private encodeCursor(cursor: SearchCursor) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(rawCursor: string, normalizedQuery: string): SearchCursor {
    if (rawCursor.length < 8 || rawCursor.length > 512) {
      throw new BadRequestException('SEARCH_CURSOR_INVALID');
    }
    try {
      const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<SearchCursor>;
      const timestamp = typeof parsed.t === 'string' ? new Date(parsed.t) : null;
      if (
        parsed.v !== 1 ||
        parsed.q !== normalizedQuery ||
        !timestamp ||
        Number.isNaN(timestamp.getTime()) ||
        !SEARCH_KINDS.includes(parsed.k as UniversalSearchKind) ||
        typeof parsed.id !== 'string' ||
        parsed.id.length < 1 ||
        parsed.id.length > 160
      ) {
        throw new Error('invalid');
      }
      return parsed as SearchCursor;
    } catch {
      throw new BadRequestException('SEARCH_CURSOR_INVALID');
    }
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
