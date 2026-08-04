import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  TooManyRequestsException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RevokeSocialConnectionIntentDto } from './dto/revoke-social-connection-intent.dto';
import { SetSocialConnectionIntentDto } from './dto/set-social-connection-intent.dto';

type Tx = Prisma.TransactionClient;

type AcceptedProposal = {
  id: string;
  firstUserId: string;
  secondUserId: string;
  status: string;
  acceptedAt: Date | null;
};

const CONNECTION_WINDOW_MS = 72 * 60 * 60 * 1_000;
const ACTION_LIMIT_PER_DAY = 12;

@Injectable()
export class SocialConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async status(userId: string, proposalId: string) {
    const proposal = await this.proposalForUser(userId, proposalId);
    await this.expireForProposal(proposalId);

    const partnerId = this.partnerId(proposal, userId);
    const deadline = this.deadline(proposal);
    const now = new Date();
    const [intent, partnerIntent, outcome, blocked] = await Promise.all([
      this.prisma.socialConnectionIntent.findUnique({
        where: { proposalId_userId: { proposalId, userId } }
      }),
      this.prisma.socialConnectionIntent.findUnique({
        where: { proposalId_userId: { proposalId, userId: partnerId } }
      }),
      this.prisma.socialConnectionOutcome.findUnique({ where: { proposalId } }),
      this.isBlocked(userId, partnerId)
    ]);

    const partnerAvailable = !partnerId.startsWith('deleted-');
    return {
      proposalId,
      available:
        partnerAvailable &&
        !blocked &&
        deadline > now,
      expiresAt: deadline,
      intent: intent
        ? {
            wantsFriendship: intent.wantsFriendship,
            wantsConversation: intent.wantsConversation,
            status: intent.status,
            version: intent.version,
            expiresAt: intent.expiresAt,
            revokedAt: intent.revokedAt,
            updatedAt: intent.updatedAt
          }
        : null,
      partnerResponded:
        partnerIntent?.status === 'ACTIVE' && partnerIntent.expiresAt > now,
      result: outcome
        ? {
            friendshipCreated: Boolean(outcome.friendshipId),
            conversationCreated: Boolean(outcome.conversationId),
            friendshipId: outcome.friendshipId,
            conversationId: outcome.conversationId,
            friendshipCreatedAt: outcome.friendshipCreatedAt,
            conversationCreatedAt: outcome.conversationCreatedAt
          }
        : {
            friendshipCreated: false,
            conversationCreated: false,
            friendshipId: null,
            conversationId: null,
            friendshipCreatedAt: null,
            conversationCreatedAt: null
          },
      privacy: {
        partnerChoicesExposed: false,
        automaticConnectionAllowed: false
      }
    };
  }

  async setIntent(
    userId: string,
    proposalId: string,
    dto: SetSocialConnectionIntentDto
  ) {
    if (!dto.wantsFriendship && !dto.wantsConversation) {
      throw new BadRequestException({
        code: 'SOCIAL_CONNECTION_EMPTY_INTENT',
        message: 'Choisis au moins une action ou utilise la révocation.'
      });
    }

    const existingReceipt = await this.receipt(userId, dto.idempotencyKey);
    if (existingReceipt) {
      return { ...(await this.status(userId, proposalId)), replayed: true };
    }
    await this.assertRateLimit(userId);

    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.socialConnectionReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) {
        return {
          replayed: true,
          partnerId: null as string | null,
          notifyPartner: false,
          createdFriendship: false,
          createdConversation: false
        };
      }

      const proposal = await tx.socialMatchProposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          firstUserId: true,
          secondUserId: true,
          status: true,
          acceptedAt: true
        }
      });
      this.assertAcceptedParticipant(proposal, userId);
      const accepted = proposal as AcceptedProposal;
      const partnerId = this.partnerId(accepted, userId);
      const deadline = this.deadline(accepted);
      const now = new Date();

      if (partnerId.startsWith('deleted-')) {
        throw new ConflictException({
          code: 'SOCIAL_CONNECTION_PARTNER_UNAVAILABLE',
          message: 'Cette personne n’est plus disponible pour cette étape.'
        });
      }
      if (deadline <= now) {
        await tx.socialConnectionIntent.updateMany({
          where: { proposalId, status: 'ACTIVE' },
          data: { status: 'EXPIRED', version: { increment: 1 } }
        });
        throw new ConflictException({
          code: 'SOCIAL_CONNECTION_WINDOW_EXPIRED',
          message: 'La fenêtre de connexion post-acceptation est expirée.'
        });
      }

      const blocked = await this.isBlockedWith(tx, userId, partnerId);
      if (blocked) {
        throw new ConflictException({
          code: 'SOCIAL_CONNECTION_BLOCKED',
          message: 'Cette connexion ne peut pas être exécutée.'
        });
      }

      const previous = await tx.socialConnectionIntent.findUnique({
        where: { proposalId_userId: { proposalId, userId } }
      });
      await tx.socialConnectionIntent.upsert({
        where: { proposalId_userId: { proposalId, userId } },
        create: {
          proposalId,
          userId,
          wantsFriendship: dto.wantsFriendship,
          wantsConversation: dto.wantsConversation,
          status: 'ACTIVE',
          expiresAt: deadline
        },
        update: {
          wantsFriendship: dto.wantsFriendship,
          wantsConversation: dto.wantsConversation,
          status: 'ACTIVE',
          expiresAt: deadline,
          revokedAt: null,
          version: { increment: 1 }
        }
      });
      await tx.socialConnectionEvent.create({
        data: {
          proposalId,
          userId,
          action: 'INTENT_SET',
          metadata: this.json({
            wantsFriendship: dto.wantsFriendship,
            wantsConversation: dto.wantsConversation
          })
        }
      });

      const partnerIntent = await tx.socialConnectionIntent.findUnique({
        where: { proposalId_userId: { proposalId, userId: partnerId } }
      });
      const partnerActive =
        partnerIntent?.status === 'ACTIVE' && partnerIntent.expiresAt > now;
      const commonFriendship =
        Boolean(partnerActive) &&
        dto.wantsFriendship &&
        Boolean(partnerIntent?.wantsFriendship);
      const commonConversation =
        Boolean(partnerActive) &&
        dto.wantsConversation &&
        Boolean(partnerIntent?.wantsConversation);

      let outcome = await tx.socialConnectionOutcome.findUnique({
        where: { proposalId }
      });
      let friendshipId = outcome?.friendshipId ?? null;
      let conversationId = outcome?.conversationId ?? null;
      let createdFriendship = false;
      let createdConversation = false;

      if (commonFriendship && !friendshipId) {
        friendshipId = await this.ensureFriendship(
          tx,
          accepted.firstUserId,
          accepted.secondUserId
        );
        createdFriendship = true;
      }
      if (commonConversation && !conversationId) {
        conversationId = await this.ensureDirectConversation(
          tx,
          accepted.firstUserId,
          accepted.secondUserId
        );
        createdConversation = true;
      }

      if (createdFriendship || createdConversation) {
        outcome = outcome
          ? await tx.socialConnectionOutcome.update({
              where: { proposalId },
              data: {
                ...(createdFriendship
                  ? { friendshipId, friendshipCreatedAt: now }
                  : {}),
                ...(createdConversation
                  ? { conversationId, conversationCreatedAt: now }
                  : {})
              }
            })
          : await tx.socialConnectionOutcome.create({
              data: {
                proposalId,
                friendshipId,
                conversationId,
                friendshipCreatedAt: createdFriendship ? now : null,
                conversationCreatedAt: createdConversation ? now : null
              }
            });
        await tx.socialConnectionEvent.create({
          data: {
            proposalId,
            userId,
            action: 'CONNECTION_EXECUTED',
            metadata: this.json({
              friendshipCreated: createdFriendship,
              conversationCreated: createdConversation,
              friendshipId: outcome.friendshipId,
              conversationId: outcome.conversationId
            })
          }
        });
      }

      await tx.socialConnectionReceipt.create({
        data: {
          userId,
          idempotencyKey: dto.idempotencyKey,
          operation: 'SET_INTENT',
          response: this.json({ proposalId })
        }
      });

      return {
        replayed: false,
        partnerId,
        notifyPartner: previous === null,
        createdFriendship,
        createdConversation
      };
    });

    if (!result.replayed && result.partnerId) {
      if (result.createdFriendship || result.createdConversation) {
        const labels = [
          result.createdFriendship ? 'une amitié' : null,
          result.createdConversation ? 'une conversation' : null
        ].filter(Boolean);
        await this.notifications.createMany(
          [userId, result.partnerId].map((recipientId) => ({
            userId: recipientId,
            type: 'SOCIAL_CONNECTION_CREATED',
            title: 'Connexion sociale confirmée',
            body: `${labels.join(' et ')} a été créée après votre choix mutuel.`,
            data: {
              route: '/matchmaking',
              entityType: 'SOCIAL_CONNECTION',
              entityId: proposalId
            }
          }))
        );
      } else if (result.notifyPartner) {
        await this.notifications.create({
          userId: result.partnerId,
          type: 'SOCIAL_CONNECTION_READY',
          title: 'Étape post-match disponible',
          body: 'Une réponse privée a été enregistrée. Tes propres choix restent nécessaires.',
          data: {
            route: '/matchmaking',
            entityType: 'SOCIAL_CONNECTION',
            entityId: proposalId
          }
        });
      }
      await this.audit.record({
        actorId: userId,
        action: 'SOCIAL_CONNECTION_INTENT_SET',
        entity: 'SocialMatchProposal',
        entityId: proposalId,
        targetAccountId: result.partnerId,
        metadata: {
          friendshipCreated: result.createdFriendship,
          conversationCreated: result.createdConversation,
          partnerChoicesExposed: false
        }
      });
    }

    return { ...(await this.status(userId, proposalId)), replayed: result.replayed };
  }

  async revokeIntent(
    userId: string,
    proposalId: string,
    dto: RevokeSocialConnectionIntentDto
  ) {
    const existingReceipt = await this.receipt(userId, dto.idempotencyKey);
    if (existingReceipt) {
      return { ...(await this.status(userId, proposalId)), replayed: true };
    }
    await this.assertRateLimit(userId);

    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.socialConnectionReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return { replayed: true, revoked: false };

      const proposal = await tx.socialMatchProposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          firstUserId: true,
          secondUserId: true,
          status: true,
          acceptedAt: true
        }
      });
      this.assertAcceptedParticipant(proposal, userId);

      const outcome = await tx.socialConnectionOutcome.findUnique({
        where: { proposalId }
      });
      if (outcome?.friendshipId || outcome?.conversationId) {
        throw new ConflictException({
          code: 'SOCIAL_CONNECTION_ALREADY_EXECUTED',
          message:
            'La connexion mutuelle a déjà été exécutée. Gère désormais l’amitié ou la conversation dans son espace dédié.'
        });
      }

      const intent = await tx.socialConnectionIntent.findUnique({
        where: { proposalId_userId: { proposalId, userId } }
      });
      let revoked = false;
      if (intent?.status === 'ACTIVE') {
        await tx.socialConnectionIntent.update({
          where: { proposalId_userId: { proposalId, userId } },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            version: { increment: 1 }
          }
        });
        await tx.socialConnectionEvent.create({
          data: { proposalId, userId, action: 'INTENT_REVOKED' }
        });
        revoked = true;
      }
      await tx.socialConnectionReceipt.create({
        data: {
          userId,
          idempotencyKey: dto.idempotencyKey,
          operation: 'REVOKE_INTENT',
          response: this.json({ proposalId, revoked })
        }
      });
      return { replayed: false, revoked };
    });

    if (result.revoked) {
      await this.audit.record({
        actorId: userId,
        action: 'SOCIAL_CONNECTION_INTENT_REVOKED',
        entity: 'SocialMatchProposal',
        entityId: proposalId,
        metadata: { partnerChoicesExposed: false }
      });
    }
    return { ...(await this.status(userId, proposalId)), replayed: result.replayed };
  }

  async expireDue(limit = 100) {
    const now = new Date();
    const intents = await this.prisma.socialConnectionIntent.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      orderBy: [{ expiresAt: 'asc' }, { proposalId: 'asc' }, { userId: 'asc' }],
      take: Math.min(500, Math.max(1, limit))
    });
    if (!intents.length) return { expiredConnectionIntents: 0 };

    let expired = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const intent of intents) {
        const changed = await tx.socialConnectionIntent.updateMany({
          where: {
            proposalId: intent.proposalId,
            userId: intent.userId,
            status: 'ACTIVE',
            expiresAt: { lte: now }
          },
          data: { status: 'EXPIRED', version: { increment: 1 } }
        });
        if (changed.count) {
          expired += 1;
          await tx.socialConnectionEvent.create({
            data: {
              proposalId: intent.proposalId,
              userId: intent.userId,
              action: 'INTENT_EXPIRED'
            }
          });
        }
      }
    });
    return { expiredConnectionIntents: expired };
  }

  async exportForAccount(userId: string) {
    const proposals = await this.prisma.socialMatchProposal.findMany({
      where: { OR: [{ firstUserId: userId }, { secondUserId: userId }] },
      select: { id: true }
    });
    const proposalIds = proposals.map((proposal) => proposal.id);
    const [intents, outcomes, events] = await Promise.all([
      this.prisma.socialConnectionIntent.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          proposalId: true,
          wantsFriendship: true,
          wantsConversation: true,
          status: true,
          version: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      proposalIds.length
        ? this.prisma.socialConnectionOutcome.findMany({
            where: { proposalId: { in: proposalIds } },
            orderBy: { updatedAt: 'desc' },
            select: {
              proposalId: true,
              friendshipId: true,
              conversationId: true,
              friendshipCreatedAt: true,
              conversationCreatedAt: true,
              createdAt: true,
              updatedAt: true
            }
          })
        : [],
      this.prisma.socialConnectionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          proposalId: true,
          action: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);
    return {
      formatVersion: 1,
      intents,
      outcomes,
      events,
      partnerChoicesIncluded: false,
      automaticConnectionsIncluded: false
    };
  }

  async deleteForAccount(userId: string, tx: Tx) {
    const proposals = await tx.socialMatchProposal.findMany({
      where: { OR: [{ firstUserId: userId }, { secondUserId: userId }] },
      select: { id: true }
    });
    const proposalIds = proposals.map((proposal) => proposal.id);
    await tx.socialConnectionReceipt.deleteMany({ where: { userId } });
    await tx.socialConnectionEvent.deleteMany({ where: { userId } });
    await tx.socialConnectionIntent.deleteMany({ where: { userId } });
    if (proposalIds.length) {
      await tx.socialConnectionOutcome.deleteMany({
        where: { proposalId: { in: proposalIds } }
      });
    }
  }

  private async proposalForUser(userId: string, proposalId: string) {
    const proposal = await this.prisma.socialMatchProposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        firstUserId: true,
        secondUserId: true,
        status: true,
        acceptedAt: true
      }
    });
    this.assertAcceptedParticipant(proposal, userId);
    return proposal as AcceptedProposal;
  }

  private assertAcceptedParticipant(
    proposal: AcceptedProposal | null,
    userId: string
  ): asserts proposal is AcceptedProposal {
    if (!proposal) {
      throw new NotFoundException({
        code: 'SOCIAL_MATCH_PROPOSAL_NOT_FOUND',
        message: 'Proposition sociale introuvable.'
      });
    }
    if (![proposal.firstUserId, proposal.secondUserId].includes(userId)) {
      throw new ForbiddenException({
        code: 'SOCIAL_MATCH_PARTICIPANT_REQUIRED',
        message: 'Cette proposition ne t’appartient pas.'
      });
    }
    if (proposal.status !== 'ACCEPTED' || !proposal.acceptedAt) {
      throw new ConflictException({
        code: 'SOCIAL_CONNECTION_ACCEPTANCE_REQUIRED',
        message: 'Une acceptation mutuelle persistée est obligatoire.'
      });
    }
  }

  private partnerId(proposal: AcceptedProposal, userId: string) {
    return proposal.firstUserId === userId
      ? proposal.secondUserId
      : proposal.firstUserId;
  }

  private deadline(proposal: AcceptedProposal) {
    return new Date((proposal.acceptedAt as Date).getTime() + CONNECTION_WINDOW_MS);
  }

  private async expireForProposal(proposalId: string) {
    const now = new Date();
    const intents = await this.prisma.socialConnectionIntent.findMany({
      where: { proposalId, status: 'ACTIVE', expiresAt: { lte: now } }
    });
    if (!intents.length) return;
    await this.prisma.$transaction(async (tx) => {
      for (const intent of intents) {
        const changed = await tx.socialConnectionIntent.updateMany({
          where: {
            proposalId,
            userId: intent.userId,
            status: 'ACTIVE',
            expiresAt: { lte: now }
          },
          data: { status: 'EXPIRED', version: { increment: 1 } }
        });
        if (changed.count) {
          await tx.socialConnectionEvent.create({
            data: {
              proposalId,
              userId: intent.userId,
              action: 'INTENT_EXPIRED'
            }
          });
        }
      }
    });
  }

  private async ensureFriendship(tx: Tx, firstUserId: string, secondUserId: string) {
    const existing = await tx.friendship.findFirst({
      where: {
        OR: [
          { requesterId: firstUserId, addresseeId: secondUserId },
          { requesterId: secondUserId, addresseeId: firstUserId }
        ]
      }
    });
    if (existing?.status === 'BLOCKED') {
      throw new ConflictException({
        code: 'SOCIAL_CONNECTION_BLOCKED',
        message: 'Une mesure de blocage empêche cette amitié.'
      });
    }
    if (existing) {
      const friendship =
        existing.status === 'ACCEPTED'
          ? existing
          : await tx.friendship.update({
              where: { id: existing.id },
              data: { status: 'ACCEPTED' }
            });
      return friendship.id;
    }
    const friendship = await tx.friendship.create({
      data: {
        requesterId: firstUserId,
        addresseeId: secondUserId,
        status: 'ACCEPTED'
      }
    });
    return friendship.id;
  }

  private async ensureDirectConversation(
    tx: Tx,
    firstUserId: string,
    secondUserId: string
  ) {
    const existing = await tx.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: firstUserId } } },
          { members: { some: { userId: secondUserId } } },
          { members: { every: { userId: { in: [firstUserId, secondUserId] } } } }
        ]
      },
      select: { id: true }
    });
    if (existing) return existing.id;

    const conversation = await tx.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [{ userId: firstUserId }, { userId: secondUserId }]
        }
      },
      select: { id: true }
    });
    return conversation.id;
  }

  private isBlocked(userId: string, partnerId: string) {
    return this.isBlockedWith(this.prisma, userId, partnerId);
  }

  private async isBlockedWith(
    database: Pick<Tx, 'socialMatchBlock' | 'friendship'>,
    userId: string,
    partnerId: string
  ) {
    if (partnerId.startsWith('deleted-')) return true;
    const [matchBlock, friendshipBlock] = await Promise.all([
      database.socialMatchBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: partnerId },
            { blockerId: partnerId, blockedId: userId }
          ]
        },
        select: { blockerId: true }
      }),
      database.friendship.findFirst({
        where: {
          status: 'BLOCKED',
          OR: [
            { requesterId: userId, addresseeId: partnerId },
            { requesterId: partnerId, addresseeId: userId }
          ]
        },
        select: { id: true }
      })
    ]);
    return Boolean(matchBlock || friendshipBlock);
  }

  private async assertRateLimit(userId: string) {
    const count = await this.prisma.socialConnectionEvent.count({
      where: {
        userId,
        action: { in: ['INTENT_SET', 'INTENT_REVOKED'] },
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1_000) }
      }
    });
    if (count >= ACTION_LIMIT_PER_DAY) {
      throw new TooManyRequestsException({
        code: 'SOCIAL_CONNECTION_RATE_LIMITED',
        message: 'Trop de changements ont été effectués récemment.'
      });
    }
  }

  private receipt(userId: string, idempotencyKey: string) {
    return this.prisma.socialConnectionReceipt.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } }
    });
  }

  private async serializable<T>(task: (tx: Tx) => Promise<T>) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(task, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code) &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException({
      code: 'SOCIAL_CONNECTION_CONFLICT',
      message: 'L’état a changé. Recharge puis recommence.'
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
