import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SavedPostsService } from './saved-posts.service';

describe('saved posts: authenticated and idempotent', () => {
  const db = {
    post: { findUnique: jest.fn() },
    $queryRaw: jest.fn(), $executeRaw: jest.fn()
  };
  const service = new SavedPostsService(db as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    db.post.findUnique.mockResolvedValue({ id: 'p1' });
    db.$queryRaw.mockResolvedValue([]);
    db.$executeRaw.mockResolvedValue(1);
  });
  it('returns only the caller account collection, limited and ordered', async () => {
    await expect(service.list('u1')).resolves.toEqual([]);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const [fragments, value] = db.$queryRaw.mock.calls[0];
    expect(fragments.join('?')).toContain('WHERE "userId" = ?');
    expect(fragments.join('?')).toContain('LIMIT 40');
    expect(value).toBe('u1');
  });
  it('checks a single account and publication pair, without inferring public state', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ saved: true }]).mockResolvedValueOnce([{ saved: false }]);
    await expect(service.status('u1', 'p1')).resolves.toEqual({ saved: true });
    await expect(service.status('u2', 'p1')).resolves.toEqual({ saved: false });
    expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual(['u1', 'p1']);
    expect(db.$queryRaw.mock.calls[1].slice(1)).toEqual(['u2', 'p1']);
  });
  it('does not write when the target publication is absent', async () => {
    db.post.findUnique.mockResolvedValue(null);
    await expect(service.save('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it('uses idempotent insert scoped to actor and post', async () => {
    await expect(service.save('u1', 'p1')).resolves.toEqual({ saved: true });
    const [sql, id, userId, postId] = db.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('ON CONFLICT ("userId", "postId") DO NOTHING');
    expect(typeof id).toBe('string');
    expect(userId).toBe('u1');
    expect(postId).toBe('p1');
  });
  it('deletes only the caller bookmark and is idempotent', async () => {
    await expect(service.unsave('u2', 'p1')).resolves.toEqual({ saved: false });
    expect(db.$executeRaw.mock.calls[0].slice(1)).toEqual(['u2', 'p1']);
  });
});
