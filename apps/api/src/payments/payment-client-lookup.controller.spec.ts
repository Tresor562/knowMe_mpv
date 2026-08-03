import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentClientLookupController } from './payment-client-lookup.controller';

describe('PaymentClientLookupController', () => {
  const reference = 'KM-FLW-ABC123-0123456789ABCDEF';

  function setup(order: { id: string; userId: string; reference: string } | null) {
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue(order)
      }
    };
    return {
      controller: new PaymentClientLookupController(prisma as never),
      prisma
    };
  }

  it('rejects malformed references before querying the database', async () => {
    const { controller, prisma } = setup(null);

    await expect(
      controller.resolve({ user: { userId: 'user-1' } }, 'invalid-reference')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.paymentOrder.findUnique).not.toHaveBeenCalled();
  });

  it('does not reveal an order owned by another account', async () => {
    const { controller } = setup({
      id: 'order-1',
      userId: 'user-2',
      reference
    });

    await expect(
      controller.resolve({ user: { userId: 'user-1' } }, reference)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only the identifier and reference for the owning account', async () => {
    const { controller, prisma } = setup({
      id: 'order-1',
      userId: 'user-1',
      reference
    });

    await expect(
      controller.resolve({ user: { userId: 'user-1' } }, reference.toLowerCase())
    ).resolves.toEqual({ id: 'order-1', reference });
    expect(prisma.paymentOrder.findUnique).toHaveBeenCalledWith({
      where: { reference },
      select: { id: true, userId: true, reference: true }
    });
  });
});
