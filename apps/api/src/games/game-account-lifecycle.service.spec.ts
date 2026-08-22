import { GameAccountLifecycleService } from './game-account-lifecycle.service';

describe('GameAccountLifecycleService KMD-187', () => {
  it('deletes game favorites even when the account has no game memberships', async () => {
    const affinityPolicy = {
      deleteForAccount: jest.fn().mockResolvedValue(undefined)
    };
    const service = new GameAccountLifecycleService(affinityPolicy as never);
    const tx = {
      gameFavorite: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      gameParticipant: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };

    await expect(service.prepareDeletion('user-1', tx as never)).resolves.toEqual({
      prepared: 0,
      redacted: 0
    });
    expect(tx.gameFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' }
    });
    expect(affinityPolicy.deleteForAccount).toHaveBeenCalledWith('user-1', tx);
  });
});
