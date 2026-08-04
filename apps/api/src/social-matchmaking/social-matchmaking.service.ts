import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  TooManyRequestsException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DecideSocialMatchDto } from './dto/decide-social-match.dto';
import { JoinSocialMatchQueueDto } from './dto/join-social-match-queue.dto';
import { UpdateSocialMatchPreferenceDto } from './dto/update-social-match-preference.dto';
import {
  compareSocialCriteria,
  normalizeSocialCriteria,
  parseStoredCriteria,
  socialCriteriaHash
} from './social-matchmaking.domain';

type Tx = Prisma.TransactionClient;

const DEFAULT_PREFERENCE = {
  matchmakingEnabled: false,
  allowNewPeople: true,
  version: 0
} as const;

@Injectable()
export class SocialMatchmakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async getPreference(userId: string) {
    const preference = await this.prisma.socialMatchPreference.findUnique({
      where: { userId }
    });
    return preference ?? { userId, ...DEFAULT_PREFERENCE };
  }

  async updatePreference(userId: string, dto: UpdateSocialMatchPreferenceDto) {
    const current = await this.getPreference(userId);
    const preference = await this.prisma.socialMatchPreference.upsert({
      where: { userId },
      create: {
        userId,
        matchmakingEnabled:
          dto.matchmakingEnabled ?? current.matchmakingEnabled,
        allowNewPeople: dto.allowNewPeople ?? current.allowNewPeople,
        version: 1
      },
      update: {
        ...(dto.matchmakingEnabled !== undefined
          ? { matchmakingEnabled: dto.matchmakingEnabled }
          : {}),
        ...(dto.allowNewPeople !== undefined
          ? { allowNewPeople: dto.allowNewPeople }
          : {}),
        version: { increment: 1 }
      }
    });
    if (!preference.matchmakingEnabled || !preference.allowNewPeople) {
      await this.leave(userId, 'PREFERENCE_DISABLED');
    }
    return preference;
  }

  async join(userId: string, dto: JoinSocialMatchQueueDto) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.status(userId)), replayed: true };

    const preference = await this.getPreference(userId);
    if (!preference.matchmakingEnabled || !preference.allowNewPeople) {
      throw new ForbiddenException({
        code: 'SOCIAL_MATCH_OPT_IN_REQUIRED',
        message: 'Active explicitement le matchmaking social avant de rejoindre la file.'
      });
    }
    await this.assertRateLimit(userId, 'JOIN_QUEUE', 8);
    const criteria = normalizeSocialCriteria(dto);
    const criteriaHash = socialCriteriaHash(criteria);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1_000);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.socialMatchReceipt.findUnique({
            where: {
              userId_idempotencyKey: {
                userId,
                idempotencyKey: dto.idempotencyKey
              }
            }
          });
          if (duplicate) return;

          const pending = await tx.socialMatchProposal.findFirst({
            where: {
              status: 'PENDING',
              OR: [{ firstUserId: userId }, { secondUserId: userId }]
            },
            select: { id: true }
          });
          if (pending) {
            throw new ConflictException({
              code: 'SOCIAL_MATCH_DECISION_REQUIRED',
              message: 'Réponds à la proposition actuelle avant de rejoindre une nouvelle file.'
            });
          }

          const entry = await tx.socialMatchQueueEntry.upsert({
            where: { userId },
            create: {
              userId,
              purpose: criteria.purpose,
              pace: criteria.pace,
              languages: this.json(criteria.languages),
              topics: this.json(criteria.topics),
              availability: this.json(criteria.availability),
              criteriaHash,
              status: 'QUEUED',
              expiresAt
            },
            update: {
              purpose: criteria.purpose,
              pace: criteria.pace,
              languages: this.json(criteria.languages),
              topics: this.json(criteria.topics),
              availability: this.json(criteria.availability),
              criteriaHash,
              status: 'QUEUED',
              joinedAt: new Date(),
              expiresAt,
              matchedAt: null,
              leftAt: null,
              version: { increment: 1 }
            }
          });
          await tx.socialMatchEvent.create({
            data: {
              userId,
              action: 'JOIN_QUEUE',
              metadata: this.json({
                purpose: criteria.purpose,
                pace: criteria.pace,
                topicCount: criteria.topics.length,
                languageCount: criteria.languages.length,
                availabilityWindowCount: criteria.availability.length
              })
            }
          });
          await tx.socialMatchReceipt.create({
            data: {
              userId,
              idempotencyKey: dto.idempotencyKey,
              operation: 'JOIN_QUEUE',
              response: this.json({ entryId: entry.id })
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        const duplicate = await this.receipt(userId, dto.idempotencyKey);
        if (!duplicate) throw this.queueConflict();
      } else {
        throw error;
      }
    }

    await this.audit.record({
      actorId: userId,
      action: 'SOCIAL_MATCH_QUEUE_JOINED',
      entity: 'SocialMatchQueueEntry',
      entityId: userId,
      metadata: {
        purpose: criteria.purpose,
        criteriaHash,
        sensitiveCriteriaUsed: false
      }
    });
    await this.matchForUser(userId);
    return { ...(await this.status(userId)), replayed: false };
  }

  async leave(userId: string, reason = 'USER_LEFT') {
    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.socialMatchQueueEntry.findUnique({ where: { userId } });
      const proposal = await tx.socialMatchProposal.findFirst({
        where: {
          status: 'PENDING',
          OR: [{ firstUserId: userId }, { secondUserId: userId }]
        }
      });
      let changed = false;
      let partnerId: string | null = null;
      if (entry && ['QUEUED', 'MATCHED'].includes(entry.status)) {
        await tx.socialMatchQueueEntry.update({
          where: { userId },
          data: {
            status: 'LEFT',
            leftAt: new Date(),
            version: { increment: 1 }
          }
        });
        changed = true;
      }
      if (proposal) {
        partnerId =
          proposal.firstUserId === userId
            ? proposal.secondUserId
            : proposal.firstUserId;
        await tx.socialMatchProposal.update({
          where: { id: proposal.id },
          data: {
            status: 'CANCELLED',
            closedReason: reason,
            version: { increment: 1 }
          }
        });
        await this.requeuePartner(tx, partnerId);
        changed = true;
      }
      if (changed) {
        await tx.socialMatchEvent.create({
          data: { userId, action: 'LEAVE_QUEUE', subjectId: partnerId, metadata: this.json({ reason }) }
        });
      }
      return { changed, partnerId };
    });
    if (result.partnerId) await this.matchForUser(result.partnerId);
    return { left: true, changed: result.changed };
  }

  async status(userId: string) {
    await this.expireUserState(userId);
    const [entry, proposal] = await Promise.all([
      this.prisma.socialMatchQueueEntry.findUnique({ where: { userId } }),
      this.prisma.socialMatchProposal.findFirst({
        where: {
          status: { in: ['PENDING', 'ACCEPTED'] },
          OR: [{ firstUserId: userId }, { secondUserId: userId }]
        },
        orderBy: { updatedAt: 'desc' }
      })
    ]);
    if (!proposal) {
      return {
        queue: entry ? this.publicEntry(entry) : null,
        proposal: null,
        sensitiveCriteriaUsed: false
      };
    }
    const partnerId =
      proposal.firstUserId === userId
        ? proposal.secondUserId
        : proposal.firstUserId;
    const [partner, decisions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true
        }
      }),
      this.prisma.socialMatchDecision.findMany({
        where: { proposalId: proposal.id },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    return {
      queue: entry ? this.publicEntry(entry) : null,
      proposal: {
        id: proposal.id,
        status: proposal.status,
        score: proposal.score,
        explanation: proposal.explanation,
        partner,
        yourDecision:
          decisions.find((decision) => decision.userId === userId)?.decision ?? null,
        partnerResponded: decisions.some((decision) => decision.userId === partnerId),
        expiresAt: proposal.expiresAt,
        acceptedAt: proposal.acceptedAt,
        createdAt: proposal.createdAt
      },
      sensitiveCriteriaUsed: false
    };
  }

  async decide(userId: string, proposalId: string, dto: DecideSocialMatchDto) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.status(userId)), replayed: true };
    await this.assertRateLimit(userId, 'DECISION', 30);

    let partnerId = '';
    let finalStatus = 'PENDING';
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.socialMatchReceipt.findUnique({
            where: {
              userId_idempotencyKey: {
                userId,
                idempotencyKey: dto.idempotencyKey
              }
            }
          });
          if (duplicate) return;

          const proposal = await tx.socialMatchProposal.findUnique({
            where: { id: proposalId }
          });
          if (!proposal) throw this.proposalNotFound();
          if (![proposal.firstUserId, proposal.secondUserId].includes(userId)) {
            throw new ForbiddenException({
              code: 'SOCIAL_MATCH_PARTICIPANT_REQUIRED',
              message: 'Cette proposition ne t’appartient pas.'
            });
          }
          partnerId =
            proposal.firstUserId === userId
              ? proposal.secondUserId
              : proposal.firstUserId;
          if (proposal.status !== 'PENDING') {
            finalStatus = proposal.status;
            await tx.socialMatchReceipt.create({
              data: {
                userId,
                idempotencyKey: dto.idempotencyKey,
                operation: 'DECISION',
                response: this.json({ proposalId, status: proposal.status })
              }
            });
            return;
          }
          const existingDecision = await tx.socialMatchDecision.findUnique({
            where: { proposalId_userId: { proposalId, userId } }
          });
          if (existingDecision) {
            finalStatus = proposal.status;
            await tx.socialMatchReceipt.create({
              data: {
                userId,
                idempotencyKey: dto.idempotencyKey,
                operation: 'DECISION',
                response: this.json({ proposalId, status: proposal.status })
              }
            });
            return;
          }

          await tx.socialMatchDecision.create({
            data: { proposalId, userId, decision: dto.decision }
          });
          if (dto.decision === 'BLOCK') {
            await tx.socialMatchBlock.upsert({
              where: { blockerId_blockedId: { blockerId: userId, blockedId: partnerId } },
              create: { blockerId: userId, blockedId: partnerId },
              update: { reason: null, createdAt: new Date() }
            });
            await this.closeRejectedProposal(tx, proposal, userId, partnerId, 'BLOCKED');
            finalStatus = 'BLOCKED';
          } else if (dto.decision === 'DECLINE') {
            await this.closeRejectedProposal(tx, proposal, userId, partnerId, 'DECLINED');
            finalStatus = 'DECLINED';
          } else {
            const accepted = await tx.socialMatchDecision.count({
              where: { proposalId, decision: 'ACCEPT' }
            });
            if (accepted === 2) {
              const changed = await tx.socialMatchProposal.updateMany({
                where: { id: proposalId, status: 'PENDING', version: proposal.version },
                data: {
                  status: 'ACCEPTED',
                  acceptedAt: new Date(),
                  version: { increment: 1 }
                }
              });
              if (changed.count !== 1) throw this.queueConflict();
              finalStatus = 'ACCEPTED';
            }
          }
          await tx.socialMatchEvent.create({
            data: {
              userId,
              action: dto.decision === 'ACCEPT' ? 'DECISION_ACCEPT' : dto.decision,
              subjectId: partnerId,
              metadata: this.json({ proposalId })
            }
          });
          await tx.socialMatchReceipt.create({
            data: {
              userId,
              idempotencyKey: dto.idempotencyKey,
              operation: 'DECISION',
              response: this.json({ proposalId, status: finalStatus })
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        const duplicate = await this.receipt(userId, dto.idempotencyKey);
        if (!duplicate) throw this.queueConflict();
      } else {
        throw error;
      }
    }

    if (finalStatus === 'DECLINED' || finalStatus === 'BLOCKED') {
      if (partnerId) {
        await this.notifications.create({
          userId: partnerId,
          type: 'SOCIAL_MATCH_CLOSED',
          title: 'Proposition clôturée',
          body: 'La proposition sociale n’est plus active.',
          data: { route: '/matchmaking', entityType: 'SOCIAL_MATCH', entityId: proposalId }
        });
        await this.matchForUser(partnerId);
      }
    } else if (finalStatus === 'ACCEPTED') {
      const proposal = await this.prisma.socialMatchProposal.findUniqueOrThrow({
        where: { id: proposalId }
      });
      await Promise.all(
        [proposal.firstUserId, proposal.secondUserId].map((recipientId) =>
          this.notifications.create({
            userId: recipientId,
            type: 'SOCIAL_MATCH_ACCEPTED',
            title: 'Connexion sociale acceptée',
            body: 'Vous avez tous les deux accepté la proposition.',
            data: { route: '/matchmaking', entityType: 'SOCIAL_MATCH', entityId: proposalId }
          })
        )
      );
    } else if (partnerId) {
      await this.notifications.create({
        userId: partnerId,
        type: 'SOCIAL_MATCH_DECISION',
        title: 'Une réponse est arrivée',
        body: 'La proposition sociale a reçu une réponse.',
        data: { route: '/matchmaking', entityType: 'SOCIAL_MATCH', entityId: proposalId }
      });
    }
    return { ...(await this.status(userId)), replayed: false };
  }

  async listBlocks(userId: string) {
    const blocks = await this.prisma.socialMatchBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' }
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: blocks.map((block) => block.blockedId) } },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    return blocks.map((block) => ({
      blockedId: block.blockedId,
      createdAt: block.createdAt,
      user: userMap.get(block.blockedId) ?? null
    }));
  }

  async unblock(userId: string, blockedId: string) {
    await this.prisma.socialMatchBlock.deleteMany({
      where: { blockerId: userId, blockedId }
    });
    return { unblocked: true };
  }

  async matchQueued(limit = 100) {
    const queued = await this.prisma.socialMatchQueueEntry.findMany({
      where: { status: 'QUEUED', expiresAt: { gt: new Date() } },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(500, Math.max(1, limit)),
      select: { userId: true }
    });
    let matched = 0;
    for (const entry of queued) {
      if (await this.matchForUser(entry.userId)) matched += 1;
    }
    return { inspected: queued.length, matched };
  }

  async matchForUser(userId: string) {
    const entry = await this.prisma.socialMatchQueueEntry.findUnique({ where: { userId } });
    if (!entry || entry.status !== 'QUEUED' || entry.expiresAt <= new Date()) return null;
    const firstCriteria = parseStoredCriteria(entry);
    const candidates = await this.prisma.socialMatchQueueEntry.findMany({
      where: {
        userId: { not: userId },
        status: 'QUEUED',
        purpose: entry.purpose,
        expiresAt: { gt: new Date() }
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: 100
    });
    if (!candidates.length) return null;

    const candidateIds = candidates.map((candidate) => candidate.userId);
    const [blocks, pending, recentDeclines] = await Promise.all([
      this.prisma.socialMatchBlock.findMany({
        where: {
          OR: [
            { blockerId: userId, blockedId: { in: candidateIds } },
            { blockerId: { in: candidateIds }, blockedId: userId }
          ]
        },
        select: { blockerId: true, blockedId: true }
      }),
      this.prisma.socialMatchProposal.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { firstUserId: { in: [userId, ...candidateIds] } },
            { secondUserId: { in: [userId, ...candidateIds] } }
          ]
        },
        select: { firstUserId: true, secondUserId: true }
      }),
      this.prisma.socialMatchEvent.findMany({
        where: {
          action: { in: ['DECLINE', 'BLOCK'] },
          createdAt: { gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000) },
          OR: [
            { userId, subjectId: { in: candidateIds } },
            { userId: { in: candidateIds }, subjectId: userId }
          ]
        },
        select: { userId: true, subjectId: true }
      })
    ]);
    const unavailable = new Set<string>();
    for (const block of blocks) {
      unavailable.add(block.blockerId === userId ? block.blockedId : block.blockerId);
    }
    for (const proposal of pending) {
      unavailable.add(proposal.firstUserId);
      unavailable.add(proposal.secondUserId);
    }
    for (const decline of recentDeclines) {
      unavailable.add(decline.userId === userId ? decline.subjectId ?? '' : decline.userId);
    }
    unavailable.delete(userId);

    const compatible = candidates
      .filter((candidate) => !unavailable.has(candidate.userId))
      .map((candidate) => ({
        candidate,
        compatibility: compareSocialCriteria(
          firstCriteria,
          parseStoredCriteria(candidate)
        )
      }))
      .filter((item) => item.compatibility.compatible)
      .sort(
        (left, right) =>
          right.compatibility.score - left.compatibility.score ||
          left.candidate.joinedAt.getTime() - right.candidate.joinedAt.getTime() ||
          left.candidate.userId.localeCompare(right.candidate.userId)
      );
    const selected = compatible[0];
    if (!selected) return null;

    let proposalId: string | null = null;
    try {
      proposalId = await this.prisma.$transaction(
        async (tx) => {
          const [first, second, active] = await Promise.all([
            tx.socialMatchQueueEntry.findUnique({ where: { userId } }),
            tx.socialMatchQueueEntry.findUnique({
              where: { userId: selected.candidate.userId }
            }),
            tx.socialMatchProposal.findFirst({
              where: {
                status: 'PENDING',
                OR: [
                  { firstUserId: { in: [userId, selected.candidate.userId] } },
                  { secondUserId: { in: [userId, selected.candidate.userId] } }
                ]
              },
              select: { id: true }
            })
          ]);
          if (
            !first ||
            !second ||
            first.status !== 'QUEUED' ||
            second.status !== 'QUEUED' ||
            first.version !== entry.version ||
            second.version !== selected.candidate.version ||
            active
          ) {
            return null;
          }
          const proposal = await tx.socialMatchProposal.create({
            data: {
              firstUserId: userId,
              secondUserId: selected.candidate.userId,
              firstEntryId: first.id,
              secondEntryId: second.id,
              score: selected.compatibility.score,
              explanation: this.json({
                sharedLanguages: selected.compatibility.sharedLanguages,
                sharedTopics: selected.compatibility.sharedTopics,
                overlapMinutes: selected.compatibility.overlapMinutes,
                paceReason: selected.compatibility.paceReason,
                explanations: selected.compatibility.explanations,
                sensitiveCriteriaUsed: false,
                affinityAnswersUsed: false,
                privateMessagesUsed: false,
                preciseLocationUsed: false
              }),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000)
            }
          });
          const firstChanged = await tx.socialMatchQueueEntry.updateMany({
            where: { id: first.id, status: 'QUEUED', version: first.version },
            data: { status: 'MATCHED', matchedAt: new Date(), version: { increment: 1 } }
          });
          const secondChanged = await tx.socialMatchQueueEntry.updateMany({
            where: { id: second.id, status: 'QUEUED', version: second.version },
            data: { status: 'MATCHED', matchedAt: new Date(), version: { increment: 1 } }
          });
          if (firstChanged.count !== 1 || secondChanged.count !== 1) {
            throw this.queueConflict();
          }
          await tx.socialMatchEvent.createMany({
            data: [
              { userId, action: 'MATCH_PROPOSED', subjectId: second.userId, metadata: this.json({ proposalId: proposal.id, score: proposal.score }) },
              { userId: second.userId, action: 'MATCH_PROPOSED', subjectId: userId, metadata: this.json({ proposalId: proposal.id, score: proposal.score }) }
            ]
          });
          return proposal.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        return null;
      }
      throw error;
    }
    if (!proposalId) return null;

    await Promise.all(
      [userId, selected.candidate.userId].map((recipientId) =>
        this.notifications.create({
          userId: recipientId,
          type: 'SOCIAL_MATCH_PROPOSAL',
          title: 'Nouvelle proposition sociale',
          body: 'Une proposition basée uniquement sur tes critères choisis est disponible.',
          data: {
            route: '/matchmaking',
            entityType: 'SOCIAL_MATCH',
            entityId: proposalId
          }
        })
      )
    );
    return proposalId;
  }

  async expireDue(limit = 100) {
    const now = new Date();
    const expiredEntries = await this.prisma.socialMatchQueueEntry.updateMany({
      where: { status: 'QUEUED', expiresAt: { lt: now } },
      data: { status: 'EXPIRED', leftAt: now, version: { increment: 1 } }
    });
    const proposals = await this.prisma.socialMatchProposal.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: Math.min(500, Math.max(1, limit))
    });
    let expiredProposals = 0;
    for (const proposal of proposals) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const update = await tx.socialMatchProposal.updateMany({
          where: { id: proposal.id, status: 'PENDING', version: proposal.version },
          data: {
            status: 'EXPIRED',
            closedReason: 'TIMEOUT',
            version: { increment: 1 }
          }
        });
        if (!update.count) return false;
        await this.requeuePartner(tx, proposal.firstUserId);
        await this.requeuePartner(tx, proposal.secondUserId);
        return true;
      });
      if (changed) expiredProposals += 1;
    }
    return { expiredEntries: expiredEntries.count, expiredProposals };
  }

  async operations(status?: string) {
    const queueStatuses = ['QUEUED', 'MATCHED', 'LEFT', 'EXPIRED'];
    const proposalStatuses = [
      'PENDING',
      'ACCEPTED',
      'DECLINED',
      'BLOCKED',
      'CANCELLED',
      'EXPIRED'
    ];
    const normalized = status?.toUpperCase();
    const [queueCounts, proposalCounts, proposals] = await Promise.all([
      this.prisma.socialMatchQueueEntry.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      this.prisma.socialMatchProposal.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      this.prisma.socialMatchProposal.findMany({
        where:
          normalized && proposalStatuses.includes(normalized)
            ? { status: normalized as never }
            : undefined,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: {
          id: true,
          firstUserId: true,
          secondUserId: true,
          status: true,
          score: true,
          expiresAt: true,
          acceptedAt: true,
          closedReason: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);
    return {
      queueCounts: Object.fromEntries(
        queueCounts
          .filter((item) => queueStatuses.includes(item.status))
          .map((item) => [item.status, item._count._all])
      ),
      proposalCounts: Object.fromEntries(
        proposalCounts.map((item) => [item.status, item._count._all])
      ),
      proposals,
      sensitiveCriteriaEnabled: false,
      affinityAnswersEnabled: false,
      preciseLocationEnabled: false
    };
  }

  async exportForAccount(userId: string) {
    const [preference, queue, decisions, proposals, blocks] = await Promise.all([
      this.prisma.socialMatchPreference.findUnique({ where: { userId } }),
      this.prisma.socialMatchQueueEntry.findUnique({ where: { userId } }),
      this.prisma.socialMatchDecision.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.socialMatchProposal.findMany({
        where: { OR: [{ firstUserId: userId }, { secondUserId: userId }] },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstUserId: true,
          secondUserId: true,
          status: true,
          score: true,
          explanation: true,
          expiresAt: true,
          acceptedAt: true,
          closedReason: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.socialMatchBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return {
      formatVersion: 1,
      preference,
      queue: queue ? this.publicEntry(queue) : null,
      decisions,
      proposals,
      blocks,
      sensitiveCriteriaIncluded: false,
      affinityAnswersIncluded: false,
      privateMessagesIncluded: false,
      preciseLocationIncluded: false
    };
  }

  async deleteForAccount(userId: string, tx: Tx) {
    const tombstone = `deleted-${randomUUID()}`;
    const proposals = await tx.socialMatchProposal.findMany({
      where: { OR: [{ firstUserId: userId }, { secondUserId: userId }] }
    });
    for (const proposal of proposals) {
      const partnerId =
        proposal.firstUserId === userId
          ? proposal.secondUserId
          : proposal.firstUserId;
      if (proposal.status === 'PENDING') {
        await tx.socialMatchProposal.update({
          where: { id: proposal.id },
          data: {
            status: 'CANCELLED',
            closedReason: 'ACCOUNT_DELETED',
            version: { increment: 1 }
          }
        });
        await this.requeuePartner(tx, partnerId);
      }
    }
    await tx.socialMatchDecision.deleteMany({ where: { userId } });
    await tx.socialMatchReceipt.deleteMany({ where: { userId } });
    await tx.socialMatchEvent.deleteMany({
      where: { OR: [{ userId }, { subjectId: userId }] }
    });
    await tx.socialMatchBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] }
    });
    await tx.socialMatchQueueEntry.deleteMany({ where: { userId } });
    await tx.socialMatchPreference.deleteMany({ where: { userId } });
    await tx.socialMatchProposal.updateMany({
      where: { firstUserId: userId },
      data: { firstUserId: tombstone }
    });
    await tx.socialMatchProposal.updateMany({
      where: { secondUserId: userId },
      data: { secondUserId: tombstone }
    });
  }

  private async closeRejectedProposal(
    tx: Tx,
    proposal: { id: string; version: number },
    userId: string,
    partnerId: string,
    status: 'DECLINED' | 'BLOCKED'
  ) {
    const changed = await tx.socialMatchProposal.updateMany({
      where: { id: proposal.id, status: 'PENDING', version: proposal.version },
      data: {
        status,
        closedReason: status,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw this.queueConflict();
    await tx.socialMatchQueueEntry.updateMany({
      where: { userId, status: 'MATCHED' },
      data: { status: 'LEFT', leftAt: new Date(), version: { increment: 1 } }
    });
    await this.requeuePartner(tx, partnerId);
  }

  private async requeuePartner(tx: Tx, userId: string) {
    const preference = await tx.socialMatchPreference.findUnique({ where: { userId } });
    const entry = await tx.socialMatchQueueEntry.findUnique({ where: { userId } });
    if (
      preference?.matchmakingEnabled &&
      preference.allowNewPeople &&
      entry &&
      entry.expiresAt > new Date()
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
      data: { status: 'LEFT', leftAt: new Date(), version: { increment: 1 } }
    });
  }

  private async expireUserState(userId: string) {
    const now = new Date();
    await this.prisma.socialMatchQueueEntry.updateMany({
      where: { userId, status: 'QUEUED', expiresAt: { lt: now } },
      data: { status: 'EXPIRED', leftAt: now, version: { increment: 1 } }
    });
    const proposal = await this.prisma.socialMatchProposal.findFirst({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
        OR: [{ firstUserId: userId }, { secondUserId: userId }]
      }
    });
    if (proposal) await this.expireDue(1);
  }

  private publicEntry(entry: {
    id: string;
    purpose: string;
    pace: string;
    languages: unknown;
    topics: unknown;
    availability: unknown;
    criteriaHash: string;
    status: string;
    joinedAt: Date;
    expiresAt: Date;
    matchedAt: Date | null;
    leftAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      id: entry.id,
      purpose: entry.purpose,
      pace: entry.pace,
      languages: entry.languages,
      topics: entry.topics,
      availability: entry.availability,
      criteriaHash: entry.criteriaHash,
      status: entry.status,
      joinedAt: entry.joinedAt,
      expiresAt: entry.expiresAt,
      matchedAt: entry.matchedAt,
      leftAt: entry.leftAt,
      updatedAt: entry.updatedAt
    };
  }

  private async assertRateLimit(userId: string, action: string, maximum: number) {
    const count = await this.prisma.socialMatchEvent.count({
      where: {
        userId,
        action: action === 'DECISION' ? { startsWith: 'DECISION' } : action,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1_000) }
      }
    });
    if (count >= maximum) {
      throw new TooManyRequestsException({
        code: 'SOCIAL_MATCH_RATE_LIMITED',
        message: 'Trop d’actions de matchmaking ont été effectuées récemment.'
      });
    }
  }

  private receipt(userId: string, idempotencyKey: string) {
    return this.prisma.socialMatchReceipt.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } }
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private proposalNotFound() {
    return new NotFoundException({
      code: 'SOCIAL_MATCH_PROPOSAL_NOT_FOUND',
      message: 'Proposition sociale introuvable.'
    });
  }

  private queueConflict() {
    return new ConflictException({
      code: 'SOCIAL_MATCH_CONFLICT',
      message: 'La file a changé. Recharge son état avant de recommencer.'
    });
  }
}
