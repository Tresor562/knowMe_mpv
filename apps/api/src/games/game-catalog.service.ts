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
    await this.prisma.gameFavorite.deleteMany({
      where: { userId, definitionKey: key }
    });
    return { removed: true, definitionKey: key };
  }
}
