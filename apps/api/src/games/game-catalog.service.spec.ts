import { NotFoundException } from '@nestjs/common';
import { GameCatalogService } from './game-catalog.service';

describe('GameCatalogService favorites', () => {
  const activeDefinitions = [
    {
      key: 'pulse-duel',
      version: 1,
      name: 'Pulse Duel',
      description: 'Fast social duel',
      minPlayers: 2,
      maxPlayers: 2
    }
  ];

  function createService() {
    const registry = {
      listActive: jest.fn().mockResolvedValue(activeDefinitions)
    };
    const gameFavorite = {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({
        definitionKey: 'pulse-duel',
        createdAt: new Date('2026-08-22T18:00:00.000Z')
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 })
    };
    const prisma = { gameFavorite };
    const service = new GameCatalogService(registry as never, prisma as never);
    return { service, registry, gameFavorite };
  }

  it('stores a favorite idempotently only for an active public game', async () => {
    const { service, gameFavorite } = createService();

    const result = await service.addFavorite('user-1', 'pulse-duel');

    expect(gameFavorite.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_definitionKey: {
          userId: 'user-1',
          definitionKey: 'pulse-duel'
        }
      },
      create: { userId: 'user-1', definitionKey: 'pulse-duel' }
    }));
    expect(result.key).toBe('pulse-duel');
    expect(result.favoritedAt).toEqual(new Date('2026-08-22T18:00:00.000Z'));
  });

  it('fails closed when a game is not active in the public catalog', async () => {
    const { service, gameFavorite } = createService();

    await expect(service.addFavorite('user-1', 'retired-game')).rejects.toBeInstanceOf(NotFoundException);
    expect(gameFavorite.upsert).not.toHaveBeenCalled();
  });

  it('does not expose stale favorites whose game is no longer public', async () => {
    const { service, gameFavorite } = createService();
    gameFavorite.findMany.mockResolvedValue([
      { definitionKey: 'retired-game', createdAt: new Date('2026-08-21T18:00:00.000Z') },
      { definitionKey: 'pulse-duel', createdAt: new Date('2026-08-22T18:00:00.000Z') }
    ]);

    const result = await service.listFavorites('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('pulse-duel');
  });

  it('removes a favorite idempotently without affecting other users', async () => {
    const { service, gameFavorite } = createService();

    await expect(service.removeFavorite('user-1', 'pulse-duel')).resolves.toEqual({
      removed: true,
      definitionKey: 'pulse-duel'
    });
    expect(gameFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', definitionKey: 'pulse-duel' }
    });
  });
});
