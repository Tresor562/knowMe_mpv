import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameEngineRegistry } from './game-engine.registry';

export type GameCenterCategory = 'instant' | 'social' | 'brain' | 'trivia' | 'strategy' | 'words';

type CatalogMetadata = {
  categories: GameCenterCategory[];
  modes: Array<'solo' | 'multiplayer'>;
  estimatedMinutes: number;
  guestEligible: boolean;
};

const METADATA: Record<string, CatalogMetadata> = {
  'pulse-duel': {
    categories: ['instant', 'social'],
    modes: ['multiplayer'],
    estimatedMinutes: 3,
    guestEligible: false
  },
  'affinity-mirror': {
    categories: ['social'],
    modes: ['multiplayer'],
    estimatedMinutes: 6,
    guestEligible: false
  },
  'quick-math': {
    categories: ['instant', 'brain'],
    modes: ['solo'],
    estimatedMinutes: 2,
    guestEligible: true
  }
};

const CATEGORIES: GameCenterCategory[] = [
  'instant',
  'social',
  'brain',
  'trivia',
  'strategy',
  'words'
];

const TERMINAL_SESSION_STATUSES = new Set([
  'COMPLETED',
  'ABANDONED',
  'CANCELLED',
  'EXPIRED'
]);

@Injectable()
export class GameCatalogService {
  constructor(
    private readonly registry: GameEngineRegistry,
    private readonly prisma: PrismaService
  ) {}

  async catalog(query?: string, category?: string) {
    const normalizedQuery = query?.trim().toLocaleLowerCase() ?? '';
    const normalizedCategory = category?.trim().toLocaleLowerCase() ?? '';
    const definitions = await this.registry.listActive();

    return definitions
      .map((definition) => {
        const metadata: CatalogMetadata = METADATA[definition.key] ?? {
          categories: [],
          modes: definition.minPlayers <= 1 ? ['solo'] : ['multiplayer'],
          estimatedMinutes: 5,
          guestEligible: false
        };
        return {
          key: definition.key,
          version: definition.version,
          name: definition.name,
          description: definition.description,
          minPlayers: definition.minPlayers,
          maxPlayers: definition.maxPlayers,
          categories: metadata.categories,
          modes: metadata.modes,
          estimatedMinutes: metadata.estimatedMinutes,
          guestEligible: metadata.guestEligible,
          authoritativeServer: true,
          replayAvailable: true,
          economicStakeAllowed: false
        };
      })
      .filter((game) => {
        if (normalizedCategory && !game.categories.includes(normalizedCategory as GameCenterCategory)) {
          return false;
        }
        if (!normalizedQuery) return true;
        const haystack = `${game.key} ${game.name} ${game.description} ${game.categories.join(' ')}`.toLocaleLowerCase();
        return haystack.includes(normalizedQuery);
      });
  }

  async guestCatalog() {
    const catalog = await this.catalog();
    return {
      playEnabled: catalog.some((game) => game.guestEligible),
      games: catalog.filter((game) => game.guestEligible)
    };
  }

  async categories() {
    const catalog = await this.catalog();
    return CATEGORIES.map((key) => ({
      key,
      nameKey: `games.category.${key}`,
      gameCount: catalog.filter((game) => game.categories.includes(key)).length
    }));
  }

  async listFavorites(userId: string) {
    const [favorites, catalog] = await Promise.all([
      this.prisma.gameFavorite.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { definitionKey: 'asc' }],
        select: { definitionKey: true, createdAt: true }
      }),
      this.catalog()
    ]);
    const byKey = new Map(catalog.map((game) => [game.key, game]));

    return favorites.flatMap((favorite) => {
      const game = byKey.get(favorite.definitionKey);
      return game ? [{ ...game, favoritedAt: favorite.createdAt }] : [];
    });
  }

  async library(userId: string) {
    const [favorites, memberships] = await Promise.all([
      this.listFavorites(userId),
      this.prisma.gameParticipant.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { sessionId: 'asc' }],
        take: 80,
        select: {
          sessionId: true,
          position: true,
          status: true,
          lastSeenAt: true,
          updatedAt: true
        }
      })
    ]);
    if (!memberships.length) {
      return { favorites, continuePlaying: [], invitations: [], recent: [] };
    }

    const membershipBySession = new Map(
      memberships.map((membership) => [membership.sessionId, membership])
    );
    const sessions = await this.prisma.gameSession.findMany({
      where: { id: { in: [...membershipBySession.keys()] } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        definitionId: true,
        definitionKey: true,
        definitionVersion: true,
        status: true,
        sequence: true,
        currentTurnPosition: true,
        expiresAt: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true
      }
    });
    const definitionIds = [...new Set(sessions.map((session) => session.definitionId))];
    const definitions = definitionIds.length
      ? await this.prisma.gameDefinition.findMany({
          where: { id: { in: definitionIds } },
          select: { id: true, name: true, description: true }
        })
      : [];
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
    const now = Date.now();

    const cards = sessions.flatMap((session) => {
      const membership = membershipBySession.get(session.id);
      if (!membership) return [];
      const definition = definitionById.get(session.definitionId);
      const status =
        ['WAITING', 'ACTIVE'].includes(session.status) && session.expiresAt.getTime() <= now
          ? 'EXPIRED'
          : session.status;
      return [{
        sessionId: session.id,
        game: {
          key: session.definitionKey,
          version: session.definitionVersion,
          name: definition?.name ?? session.definitionKey,
          description: definition?.description ?? ''
        },
        status,
        sequence: session.sequence,
        participantStatus: membership.status,
        yourTurn:
          status === 'ACTIVE' &&
          membership.status === 'JOINED' &&
          session.currentTurnPosition === membership.position,
        lastSeenAt: membership.lastSeenAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      }];
    });

    return {
      favorites,
      continuePlaying: cards.filter((card) => card.participantStatus === 'JOINED' && ['WAITING', 'ACTIVE'].includes(card.status)).slice(0, 20),
      invitations: cards.filter((card) => card.participantStatus === 'INVITED' && card.status === 'WAITING').slice(0, 20),
      recent: cards.filter((card) => card.participantStatus !== 'INVITED' && TERMINAL_SESSION_STATUSES.has(card.status)).slice(0, 20)
    };
  }

  async addFavorite(userId: string, definitionKey: string) {
    const key = definitionKey.trim();
    const catalog = await this.catalog();
    const game = catalog.find((candidate) => candidate.key === key);
    if (!game) {
      throw new NotFoundException({
        code: 'GAME_NOT_AVAILABLE',
        message: 'This game is not available in the public catalog.'
      });
    }

    const favorite = await this.prisma.gameFavorite.upsert({
      where: { userId_definitionKey: { userId, definitionKey: key } },
      update: {},
      create: { userId, definitionKey: key },
      select: { definitionKey: true, createdAt: true }
    });
    return { ...game, favoritedAt: favorite.createdAt };
  }

  async removeFavorite(userId: string, definitionKey: string) {
    const key = definitionKey.trim();
    await this.prisma.gameFavorite.deleteMany({ where: { userId, definitionKey: key } });
    return { removed: true, definitionKey: key };
  }
}
