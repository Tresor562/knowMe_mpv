import { SocialGiftExportService } from './social-gift-export.service';

describe('SocialGiftExportService', () => {
  it('exports received receipts and sent KnowCoin debits separately', async () => {
    const receivedAt = new Date('2026-08-03T12:00:00.000Z');
    const sentAt = new Date('2026-08-03T12:01:00.000Z');
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sg_receipt',
            type: 'SOCIAL_GIFT',
            title: 'Nouveau cadeau reçu',
            body: 'Une étincelle reçue.',
            data: { senderId: 'sender-1', giftKey: 'spark' },
            createdAt: receivedAt,
            readAt: null
          }
        ])
      },
      knowCoinLedgerEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ledger-1',
            amount: -25,
            balanceBefore: 100,
            balanceAfter: 75,
            type: 'SOCIAL_GIFT_SENT',
            source: 'SOCIAL_GIFT',
            idempotencyKey: 'gift:test:00000001',
            referenceType: 'SOCIAL_GIFT',
            referenceId: 'sg_receipt',
            reason: 'Cadeau social spark',
            metadata: { recipientId: 'recipient-1', giftKey: 'spark' },
            createdAt: sentAt
          }
        ])
      }
    };

    const service = new SocialGiftExportService(prisma as never);

    await expect(service.exportForAccount('user-1')).resolves.toEqual({
      schemaVersion: 1,
      received: [
        expect.objectContaining({
          id: 'sg_receipt',
          data: { senderId: 'sender-1', giftKey: 'spark' }
        })
      ],
      sent: [
        expect.objectContaining({
          id: 'ledger-1',
          amount: -25,
          recipientBalanceCredited: false,
          visualOnly: true,
          redeemable: false,
          transferable: false
        })
      ]
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', type: 'SOCIAL_GIFT' }
      })
    );
    expect(prisma.knowCoinLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          type: 'SOCIAL_GIFT_SENT',
          source: 'SOCIAL_GIFT'
        }
      })
    );
  });
});
