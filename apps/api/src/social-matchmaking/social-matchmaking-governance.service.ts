import { Injectable, TooManyRequestsException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DecideSocialMatchDto } from './dto/decide-social-match.dto';
import { SocialMatchmakingService } from './social-matchmaking.service';

@Injectable()
export class SocialMatchmakingGovernanceService extends SocialMatchmakingService {
  constructor(
    private readonly database: PrismaService,
    notifications: NotificationsService,
    audit: AuditService
  ) {
    super(database, notifications, audit);
  }

  override async status(userId: string) {
    await this.expireExactProposalForUser(userId);
    return super.status(userId);
  }

  override async decide(
    userId: string,
    proposalId: string,
    dto: DecideSocialMatchDto
  ) {
    const decisionsInLastDay = await this.database.socialMatchEvent.count({
      where: {
        userId,
        action: { in: ['DECISION_ACCEPT', 'DECLINE', 'BLOCK'] },
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1_000) }
      }
    });
    if (decisionsInLastDay >= 30) {
      throw new TooManyRequestsException({
        code: 'SOCIAL_MATCH_RATE_LIMITED',
        message: 'Trop d’actions de matchmaking ont été effectuées récemment.'
      });
    }
    return super.decide(userId, proposalId, dto);
  }

  override async exportForAccount(userId: string) {
    const exported = await super.exportForAccount(userId);
    return {
      ...exported,
      blocks: exported.blocks.filter((block) => block.blockerId === userId)
    };
  }

  private async expireExactProposalForUser(userId: string) {
    const now = new Date();
    const proposal = await this.database.socialMatchProposal.findFirst({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
        OR: [{ firstUserId: userId }, { secondUserId: userId }]
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }]
    });
    if (!proposal) return;

    await this.database.$transaction(
      async (tx) => {
        const changed = await tx.socialMatchProposal.updateMany({
          where: {
            id: proposal.id,
            status: 'PENDING',
            version: proposal.version
          },
          data: {
            status: 'EXPIRED',
            closedReason: 'TIMEOUT',
            version: { increment: 1 }
          }
        });
        if (changed.count !== 1) return;
        await this.restoreQueueAfterClosure(tx, proposal.firstUserId, now);
        await this.restoreQueueAfterClosure(tx, proposal.secondUserId, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async restoreQueueAfterClosure(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date
  ) {
    const [preference, entry] = await Promise.all([
      tx.socialMatchPreference.findUnique({ where: { userId } }),
      tx.socialMatchQueueEntry.findUnique({ where: { userId } })
    ]);
    if (
      preference?.matchmakingEnabled &&
      preference.allowNewPeople &&
      entry &&
      entry.expiresAt > now
    ) {
      await tx.socialMatchQueueEntry.updateMany({
        where: { userId, status: 'MATCHED' },
        data: {
          status: 'QUEUED',
          matchedAt: null,
          version: { increment: 1 }
        }
      });
      return;
    }
    await tx.socialMatchQueueEntry.updateMany({
      where: { userId, status: 'MATCHED' },
      data: {
        status: 'LEFT',
        leftAt: now,
        version: { increment: 1 }
      }
    });
  }
}
