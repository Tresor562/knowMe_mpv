import { NotFoundException } from '@nestjs/common';
import { GameCatalogService } from './game-catalog.service';

describe('GameCatalogService', () => {
  const activeDefinitions = [
    {
      id: 'definition-1',
      key: 'pulse-duel',
      version: 1,
      name: 'Pulse Duel',
      description: 'Fast social duel',
      minPlayers: 2,
      maxPlayers: 2
    }
  ];

  function createService() {
    const registry = { listActive: jest.fn().mockResolvedValue(activeDefinitions) };
    const gameFavorite = {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({
        definitionKey: 'pulse-duel',
        createdAt: new Date('2026-08-22T18:00:00.000Z')
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 })
    };
    const gameParticipant = { findMany: jest.fn().mockResolvedValue([]) };
    const gameSession = { findMany: jest.fn().mockResolvedValue([]) };
    const gameDefinition = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma = { gameFavorite, gameParticipant, gameSession, gameDefinition };
    const service = new GameCatalogService(registry as never, prisma as never);
    return { service, registry, gameFavorite, gameParticipant, gameSession, gameDefinition };
  }

  it('stores a favorite idempotently only for an active public game', async () => {
    const { service, gameFavorite } = createService();
    const result = await service.addFavorite('user-1', 'pulse-duel');
    expect(gameFavorite.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_definitionKey: { userId: 'user-1', definitionKey: 'pulse-duel' } },
      create: { userId: 'user-1', definitionKey: 'pulse-duel' }
    }));
    expect(result.key).toBe('pulse-duel');
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

  it('returns a bounded empty private library when the account has no game sessions', async () => {
    const { service, gameSession, gameDefinition } = createService();
    await expect(service.library('user-1')).resolves.toEqual({
      favorites: [],
      continuePlaying: [],
      invitations: [],
      recent: []
    });
    expect(gameSession.findMany).not.toHaveBeenCalled();
    expect(gameDefinition.findMany).not.toHaveBeenCalled();
  });

  it('classifies active, invited and recent sessions without exposing private game state', async () => {
    const { service, gameParticipant, gameSession, gameDefinition } = createService();
    const future = new Date(Date.now() + 60_000);
    gameParticipant.findMany.mockResolvedValue([
      { sessionId: 'active', position: 0, status: 'JOINED', lastSeenAt: null, updatedAt: new Date() },
      { sessionId: 'invite', position: 1, status: 'INVITED', lastSeenAt: null, updatedAt: new Date() },
      { sessionId: 'done', position: 0, status: 'COMPLETED', lastSeenAt: null, updatedAt: new Date() }
    ]);
    gameSession.findMany.mockResolvedValue([
      { id: 'active', definitionId: 'definition-1', definitionKey: 'pulse-duel', definitionVersion: 1, status: 'ACTIVE', sequence: 2, currentTurnPosition: 0, expiresAt: future, startedAt: new Date(), completedAt: null, updatedAt: new Date() },
      { id: 'invite', definitionId: 'definition-1', definitionKey: 'pulse-duel', definitionVersion: 1, status: 'WAITING', sequence: 0, currentTurnPosition: 0, expiresAt: future, startedAt: null, completedAt: null, updatedAt: new Date() },
      { id: 'done', definitionId: 'definition-1', definitionKey: 'pulse-duel', definitionVersion: 1, status: 'COMPLETED', sequence: 4, currentTurnPosition: null, expiresAt: future, startedAt: new Date(), completedAt: new Date(), updatedAt: new Date() }
    ]);
    gameDefinition.findMany.mockResolvedValue([{ id: 'definition-1', name: 'Pulse Duel', description: 'Fast social duel' }]);

    const result = await service.library('user-1');
    expect(result.continuePlaying.map((item) => item.sessionId)).toEqual(['active']);
    expect(result.continuePlaying[0]?.yourTurn).toBe(true);
    expect(result.invitations.map((item) => item.sessionId)).toEqual(['invite']);
    expect(result.recent.map((item) => item.sessionId)).toEqual(['done']);

    const query = gameSession.findMany.mock.calls[0]?.[0];
    expect(query.take).toBe(50);
    expect(query.select).not.toHaveProperty('state');
    expect(query.select).not.toHaveProperty('seed');
    expect(query.select).not.toHaveProperty('result');
    expect(query.select).not.toHaveProperty('ownerId');
    expect(query.select).not.toHaveProperty('winnerUserId');
  });

  it('does not offer an expired active session as continue playing', async () => {
    const { service, gameParticipant, gameSession, gameDefinition } = createService();
    gameParticipant.findMany.mockResolvedValue([
      { sessionId: 'expired', position: 0, status: 'JOINED', lastSeenAt: null, updatedAt: new Date() }
    ]);
    gameSession.findMany.mockResolvedValue([
      { id: 'expired', definitionId: 'definition-1', definitionKey: 'pulse-duel', definitionVersion: 1, status: 'ACTIVE', sequence: 1, currentTurnPosition: 0, expiresAt: new Date(Date.now() - 1_000), startedAt: new Date(), completedAt: null, updatedAt: new Date() }
    ]);
    gameDefinition.findMany.mockResolvedValue([{ id: 'definition-1', name: 'Pulse Duel', description: 'Fast social duel' }]);

    const result = await service.library('user-1');
    expect(result.continuePlaying).toEqual([]);
    expect(result.recent[0]).toEqual(expect.objectContaining({ sessionId: 'expired', status: 'EXPIRED' }));
  });
});
