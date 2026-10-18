import { BadRequestException } from '@nestjs/common';
import { PostLikeStatusController } from './post-like-status.controller';

describe('PostLikeStatusController', () => {
  const findMany = jest.fn();
  const controller = new PostLikeStatusController({
    postLike: { findMany }
  } as any);
  const session = { user: { userId: 'user-a' } };

  beforeEach(() => findMany.mockReset());

  it('returns only caller-owned like flags, including explicit false for unliked posts', async () => {
    findMany.mockResolvedValue([{ postId: 'post-a' }]);
    await expect(controller.readMine(session, 'post-a,post-b,post-a')).resolves.toEqual({
      'post-a': true, 'post-b': false
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', postId: { in: ['post-a', 'post-b'] } },
      select: { postId: true }
    });
  });

  it('never uses another user\'s identity', async () => {
    findMany.mockResolvedValue([]);
    await controller.readMine({user:{userId:'user-b'}}, 'post-a');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-b', postId: { in: ['post-a'] } }
    }));
  });

  it.each([undefined, null, '', [], ['post-a','post-b'], ',post-a', 'a,'.concat(',b'),
    'bad/path', 'a,'.concat('a,'.repeat(50))])(
    'rejects invalid or oversized input %p before querying the database',
    async (ids) => {
      await expect(controller.readMine(session, ids)).rejects.toBeInstanceOf(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    }
  );
});
