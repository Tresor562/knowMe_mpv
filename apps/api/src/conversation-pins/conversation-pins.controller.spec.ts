import { BadRequestException } from '@nestjs/common';
import { ConversationPinsController } from './conversation-pins.controller';

describe('ConversationPinsController', () => {
  const makeController = () => {
    const pins = {
      list: jest.fn(),
      reorder: jest.fn(),
      pin: jest.fn(),
      unpin: jest.fn()
    };
    return {
      pins,
      controller: new ConversationPinsController(pins as never)
    };
  };

  it('requires an optimistic authoritative baseline for HTTP reorder mutations', () => {
    const { controller, pins } = makeController();

    expect(() =>
      controller.reorder(
        { user: { userId: 'u1' } },
        { conversationIds: ['c2', 'c1'] }
      )
    ).toThrow(BadRequestException);
    expect(pins.reorder).not.toHaveBeenCalled();
  });

  it('rejects a malformed optimistic baseline before calling the service', () => {
    const { controller, pins } = makeController();

    expect(() =>
      controller.reorder(
        { user: { userId: 'u1' } },
        { conversationIds: ['c2', 'c1'], expectedConversationIds: ['c1', 2] }
      )
    ).toThrow(BadRequestException);
    expect(pins.reorder).not.toHaveBeenCalled();
  });

  it('forwards the complete desired and observed orders to the service', () => {
    const { controller, pins } = makeController();
    pins.reorder.mockReturnValue({ reordered: true });

    expect(
      controller.reorder(
        { user: { userId: 'u1' } },
        {
          conversationIds: ['c2', 'c1'],
          expectedConversationIds: ['c1', 'c2']
        }
      )
    ).toEqual({ reordered: true });
    expect(pins.reorder).toHaveBeenCalledWith('u1', ['c2', 'c1'], ['c1', 'c2']);
  });
});
