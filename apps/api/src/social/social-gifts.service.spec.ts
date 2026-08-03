import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { SocialGiftsService } from './social-gifts.service';

describe('SocialGiftsService', () => {
  const senderId = 'user_sender_123';
  const recipientId = 'user_friend_456';
  const idempotencyKey = 'gift:test:recipient:spark:12345678';

  function setup(friendshipStatus: string | null = 'ACCEPTED') {
    const giftId = `sg_${createHash('sha256')
      .update(`knowme-social-gift:${senderId}:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 28)}`;
    const createdAt = new Date('2026-08-03T12:00:00.000Z');
    const tx = {
      knowCoinLedgerEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: recipientId,
          isSuspended: false
        })
      },
      friendship: {
        findFirst: jest.fn().mockResolvedValue(
          friendshipStatus ? { status: friendshipStatus } : null
        )
      },
      notification: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          ...data,
          createdAt,
          readAt: null
        }))
      }
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
      user: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const wallet = {
      applyInTransaction: jest.fn().mockResolvedValue({
        replayed: false,
        entry: {
          id: 'ledger-1',
          userId: senderId,
          amount: -25,
          balanceBefore: 100,
          balanceAfter: 75,
          type: 'SOCIAL_GIFT_SENT',
          source: 'SOCIAL_GIFT',
          idempotencyKey,
          referenceType: 'SOCIAL_GIFT',
          referenceId: giftId,
          metadata: null,
          createdAt
        }
      })
    };
    const notifications = {
      publishCreated: jest.fn((notification) => notification),
      markRead: jest.fn()
    };
    return {
      giftId,
      tx,
      prisma,
      wallet,
      notifications,
      service: new SocialGiftsService(
        prisma as never,
        wallet as never,
        notifications as never
      )
    };
  }

  it('debits the authoritative price and creates the recipient receipt atomically', async () => {
    const { service, tx, prisma, wallet, notifications, giftId } = setup();

    await expect(
      service.send(
        senderId,
        { recipientId, giftKey: 'spark', message: 'Bravo !' },
        idempotencyKey
      )
    ).resolves.toMatchObject({
      giftId,
      recipientId,
      senderBalance: 75,
      replayed: false,
      recipientBalanceCredited: false,
      immutableReceipt: true
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(wallet.applyInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: senderId,
        amount: -25,
        type: 'SOCIAL_GIFT_SENT',
        source: 'SOCIAL_GIFT',
        idempotencyKey,
        referenceId: giftId
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: giftId,
        userId: recipientId,
        type: 'SOCIAL_GIFT'
      })
    });
    expect(notifications.publishCreated).toHaveBeenCalledTimes(1);
  });

  it('refuses gifts outside an accepted friendship before any debit', async () => {
    const { service, wallet } = setup(null);

    await expect(
      service.send(
        senderId,
        { recipientId, giftKey: 'spark' },
        idempotencyKey
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(wallet.applyInTransaction).not.toHaveBeenCalled();
  });

  it('rejects self-gifting and malformed idempotency keys', async () => {
    const { service, prisma } = setup();

    await expect(
      service.send(
        senderId,
        { recipientId: senderId, giftKey: 'spark' },
        idempotencyKey
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.send(senderId, { recipientId, giftKey: 'spark' }, 'bad key')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
