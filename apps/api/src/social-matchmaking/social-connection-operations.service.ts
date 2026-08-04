import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialConnectionOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot() {
    const [intentCounts, outcomes, recentEvents] = await Promise.all([
      this.prisma.socialConnectionIntent.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      this.prisma.socialConnectionOutcome.findMany({
        orderBy: [{ updatedAt: 'desc' }, { proposalId: 'desc' }],
        take: 100,
        select: {
          proposalId: true,
          friendshipId: true,
          conversationId: true,
          friendshipCreatedAt: true,
          conversationCreatedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.socialConnectionEvent.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: {
          id: true,
          proposalId: true,
          userId: true,
          action: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);

    return {
      intentCounts: Object.fromEntries(
        intentCounts.map((item) => [item.status, item._count._all])
      ),
      outcomes,
      recentEvents,
      policy: {
        windowHours: 72,
        actionLimitPerUserPerDay: 12,
        partnerChoicesExposed: false,
        automaticConnectionAllowed: false
      }
    };
  }
}
