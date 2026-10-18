import { BadRequestException } from '@nestjs/common';
import { StoriesController } from './stories.controller';

describe('StoriesController: viewers cursor validation', () => {
  const viewers = jest.fn().mockResolvedValue({ viewers: [], nextCursor: null });
  const controller = new StoriesController(
    { viewers } as any, {} as any, {} as any, {} as any, {} as any
  );

  beforeEach(() => viewers.mockClear());

  it('accepts an opaque cursor only for the authenticated owner request', async () => {
    const req = {user: {userId:'author'}};
    await expect(controller.viewers(req,'story-1','ck9Yrx_A0-1')).resolves.toEqual({
      viewers: [], nextCursor: null
    });
    expect(viewers).toHaveBeenCalledWith('author','story-1','ck9Yrx_A0-1');
  });

  it.each(['../../other', 'a b', '', 'x'.repeat(81)])(
    'rejects invalid cursors before touching the service: %s', (cursor) => {
      expect(() => controller.viewers({user: {userId:'author'}},'story-1',cursor))
        .toThrow(BadRequestException);
      expect(viewers).not.toHaveBeenCalled();
    }
  );
});
