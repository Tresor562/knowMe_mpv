import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePositiveChallengeDto,
  POSITIVE_CHALLENGE_KINDS
} from './dto/positive-challenge.dto';

const MAX_DAILY_INVITATIONS = 5;
const MAX_ACTIVE_PER_PAIR = 2;
const EXPIRATION_HOURS = 72;
const TRANSACTION_ATTEMPTS = 3;
const ACTIVE_STATUSES = ['INVITED', 'ACCEPTED', 'COMPLETION_PENDING'];

const CATALOG = {
  GRATITUDE_NOTE: {
    title: 'Un mot de gratitude',
    description: 'Partager une chose sincère que tu apprécies chez ton ami.'
  },
  ENCOURAGEMENT: {
    title: 'Encouragement du jour',
    description: 'Envoyer un encouragement positif, sans attente en retour.'
  },
  HELPING_HAND: {
    title: 'Petit coup de main',
    description: 'Proposer une aide simple que l’autre peut librement accepter.'
  },
  SHARED_REFLECTION: {
    title: 'Réflexion à deux',
    description: 'Échanger calmement sur un souvenir ou un objectif commun.'
  }
} as const;

type PositiveChallengeKind = (typeof POSITIVE_CHALLENGE_KINDS)[number];

@Injectable()
export class PositiveChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  catalog() {
    return {
      items: POSITIVE_CHALLENGE_KINDS.map((key) => ({ key, ...CATALOG[key] })),
      rules: this.rules()
    };
  }

  async create(creatorId: string, dto: CreatePositiveChallengeDto) {
    if (creatorId === dto.recipientId) {
      throw new BadRequestException('Un Positive Challenge doit impliquer un ami.');
    }

    await this.assertAcceptedFriendship(creatorId, dto.recipientId);
    const challengeDate = this.utcDay(new Date());
    const note = dto.note?.trim() || null;
    const expiresAt = new Date(Date.now() + EXPIRATION_HOURS * 60 * 60 * 1000);

    for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.positiveChallenge.findUnique({
              where: {
                creatorId_recipientId_kind_challengeDate: {
                  creatorId,
                  recipientId: dto.recipientId,
                  kind: dto.kind,
                  challengeDate
                }
              },
              include: { events: { orderBy: { createdAt: 'asc' } } }
            });
            if (existing) return { challenge: existing, replayed: true };

            const [dailyCount, activePairCount] = await Promise.all([
              tx.positiveChallenge.count({ where: { creatorId, challengeDate } }),
              tx.positiveChallenge.count({
                where: {
                  status: { in: ACTIVE_STATUSES },
                  OR: [
                    { creatorId, recipientId: dto.recipientId },
                    { creatorId: dto.recipientId, recipientId: creatorId }
                  ]
                }
              })
            ]);

            if (dailyCount >= MAX_DAILY_INVITATIONS) {
              throw new BadRequestException(
                'La limite quotidienne de Positive Challenges est atteinte.'
              );
            }
            if (activePairCount >= MAX_ACTIVE_PER_PAIR) {
              throw new ConflictException(
                'Trop de Positive Challenges sont déjà actifs entre vous.'
              );
            }

            const challenge = await tx.positiveChallenge.create({
              data: {
                creatorId,
                recipientId: dto.recipientId,
                kind: dto.kind,
                note,
                challengeDate,
                expiresAt
              }
            });
            await tx.positiveChallengeEvent.create({
              data: {
                challengeId: challenge.id,
                actorId: creatorId,
                type: 'INVITED',
                idempotencyKey: `positive:${challenge.id}:INVITED`,
                metadata: { kind: dto.kind }
              }
            });

            return {
              challenge: await tx.positiveChallenge.findUniqueOrThrow({
                where: { id: challenge.id },
                include: { events: { orderBy: { createdAt: 'asc' } } }
              }),
              replayed: false
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        if (!result.replayed) {
          await Promise.all([
            this.notifications.create({
              userId: dto.recipientId,
              type: 'POSITIVE_CHALLENGE_INVITED',
              title: 'Nouveau Positive Challenge',
              body: `${CATALOG[dto.kind].title} — tu peux accepter ou refuser librement.`,
              data: {
                route: '/positive-challenges',
                entityType: 'POSITIVE_CHALLENGE',
                entityId: result.challenge.id,
                actorId: creatorId
              }
            }),
            this.audit.record({
              actorId: creatorId,
              action: 'POSITIVE_CHALLENGE_CREATED',
              entity: 'PositiveChallenge',
              entityId: result.challenge.id,
              targetAccountId: dto.recipientId,
              metadata: { kind: dto.kind, expiresAt }
            })
          ]);
        }

        return { ...this.publicChallenge(result.challenge), replayed: result.replayed };
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const replay = await this.prisma.positiveChallenge.findUnique({
            where: {
              creatorId_recipientId_kind_challengeDate: {
                creatorId,
                recipientId: dto.recipientId,
                kind: dto.kind,
                challengeDate
              }
            },
            include: { events: { orderBy: { createdAt: 'asc' } } }
          });
          if (replay) return { ...this.publicChallenge(replay), replayed: true };
        }
        if (this.isRetryableTransaction(error) && attempt < TRANSACTION_ATTEMPTS - 1) {
          await this.backoff(attempt);
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Positive Challenge temporairement indisponible.');
  }

  async respond(userId: string, challengeId: string, accept: boolean) {
    const desiredStatus = accept ? 'ACCEPTED' : 'DECLINED';
    const result = await this.transition(challengeId, async (tx, challenge) => {
      if (challenge.recipientId !== userId) throw new NotFoundException('Invitation introuvable.');
      if (challenge.status === desiredStatus) return { challenge, replayed: true };
      if (challenge.status !== 'INVITED') {
        throw new BadRequestException('Cette invitation ne peut plus être traitée.');
      }
      if (challenge.expiresAt <= new Date()) {
        return this.expireInTransaction(tx, challenge);
      }

      const now = new Date();
      const updated = await tx.positiveChallenge.update({
        where: { id: challenge.id },
        data: accept
          ? { status: 'ACCEPTED', acceptedAt: now }
          : { status: 'DECLINED', declinedAt: now }
      });
      await tx.positiveChallengeEvent.create({
        data: {
          challengeId: challenge.id,
          actorId: userId,
          type: desiredStatus,
          idempotencyKey: `positive:${challenge.id}:${desiredStatus}`
        }
      });
      return { challenge: updated, replayed: false };
    });

    if (!result.replayed) {
      await this.audit.record({
        actorId: userId,
        action: accept ? 'POSITIVE_CHALLENGE_ACCEPTED' : 'POSITIVE_CHALLENGE_DECLINED',
        entity: 'PositiveChallenge',
        entityId: challengeId,
        targetAccountId: result.challenge.creatorId,
        metadata: { noPenalty: true }
      });
      if (accept) {
        await this.notifications.create({
          userId: result.challenge.creatorId,
          type: 'POSITIVE_CHALLENGE_ACCEPTED',
          title: 'Positive Challenge accepté',
          body: 'Ton ami a accepté librement le défi positif.',
          data: {
            route: '/positive-challenges',
            entityType: 'POSITIVE_CHALLENGE',
            entityId: challengeId,
            actorId: userId
          }
        });
      }
    }

    return { ...this.publicChallenge(result.challenge), replayed: result.replayed };
  }

  async confirm(userId: string, challengeId: string) {
    const result = await this.transition(challengeId, async (tx, challenge) => {
      const isCreator = challenge.creatorId === userId;
      const isRecipient = challenge.recipientId === userId;
      if (!isCreator && !isRecipient) throw new NotFoundException('Défi positif introuvable.');
      if (challenge.status === 'COMPLETED') return { challenge, replayed: true };
      if (!['ACCEPTED', 'COMPLETION_PENDING'].includes(challenge.status)) {
        throw new BadRequestException('Le défi doit être accepté avant confirmation.');
      }
      if (challenge.expiresAt <= new Date()) {
        return this.expireInTransaction(tx, challenge);
      }
      if ((isCreator && challenge.creatorConfirmedAt) || (isRecipient && challenge.recipientConfirmedAt)) {
        return { challenge, replayed: true };
      }

      const now = new Date();
      const creatorConfirmedAt = isCreator ? now : challenge.creatorConfirmedAt;
      const recipientConfirmedAt = isRecipient ? now : challenge.recipientConfirmedAt;
      const completed = Boolean(creatorConfirmedAt && recipientConfirmedAt);
      const updated = await tx.positiveChallenge.update({
        where: { id: challenge.id },
        data: {
          creatorConfirmedAt,
          recipientConfirmedAt,
          status: completed ? 'COMPLETED' : 'COMPLETION_PENDING',
          completedAt: completed ? now : null
        }
      });
      await tx.positiveChallengeEvent.create({
        data: {
          challengeId: challenge.id,
          actorId: userId,
          type: 'CONFIRMED',
          idempotencyKey: `positive:${challenge.id}:CONFIRMED:${userId}`,
          metadata: { completed }
        }
      });
      if (completed) {
        await tx.positiveChallengeEvent.create({
          data: {
            challengeId: challenge.id,
            actorId: userId,
            type: 'COMPLETED',
            idempotencyKey: `positive:${challenge.id}:COMPLETED`,
            metadata: { reward: null }
          }
        });
      }
      return { challenge: updated, replayed: false };
    });

    if (!result.replayed) {
      await this.audit.record({
        actorId: userId,
        action: result.challenge.status === 'COMPLETED'
          ? 'POSITIVE_CHALLENGE_COMPLETED'
          : 'POSITIVE_CHALLENGE_CONFIRMED',
        entity: 'PositiveChallenge',
        entityId: challengeId,
        targetAccountId:
          result.challenge.creatorId === userId
            ? result.challenge.recipientId
            : result.challenge.creatorId,
        metadata: { reward: null, doubleConfirmationRequired: true }
      });
    }

    return { ...this.publicChallenge(result.challenge), replayed: result.replayed };
  }

  async cancel(userId: string, challengeId: string) {
    const result = await this.transition(challengeId, async (tx, challenge) => {
      if (challenge.creatorId !== userId) throw new NotFoundException('Défi positif introuvable.');
      if (challenge.status === 'CANCELLED') return { challenge, replayed: true };
      if (!ACTIVE_STATUSES.includes(challenge.status)) {
        throw new BadRequestException('Ce défi positif ne peut plus être annulé.');
      }

      const updated = await tx.positiveChallenge.update({
        where: { id: challenge.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() }
      });
      await tx.positiveChallengeEvent.create({
        data: {
          challengeId: challenge.id,
          actorId: userId,
          type: 'CANCELLED',
          idempotencyKey: `positive:${challenge.id}:CANCELLED`,
          metadata: { noPenalty: true }
        }
      });
      return { challenge: updated, replayed: false };
    });

    if (!result.replayed) {
      await this.audit.record({
        actorId: userId,
        action: 'POSITIVE_CHALLENGE_CANCELLED',
        entity: 'PositiveChallenge',
        entityId: challengeId,
        targetAccountId: result.challenge.recipientId,
        metadata: { noPenalty: true }
      });
    }
    return { ...this.publicChallenge(result.challenge), replayed: result.replayed };
  }

  async me(userId: string) {
    await this.expireOutstanding(userId);
    const challenges = await this.prisma.positiveChallenge.findMany({
      where: { OR: [{ creatorId: userId }, { recipientId: userId }] },
      include: { events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    const accountIds = [...new Set(challenges.flatMap((item) => [item.creatorId, item.recipientId]))];
    const accounts = await this.prisma.user.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));

    return {
      items: challenges.map((challenge) => ({
        ...this.publicChallenge(challenge),
        role: challenge.creatorId === userId ? 'CREATOR' : 'RECIPIENT',
        creator: byId.get(challenge.creatorId) ?? null,
        recipient: byId.get(challenge.recipientId) ?? null
      })),
      rules: this.rules()
    };
  }

  utcDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private async transition(
    challengeId: string,
    action: (
      tx: Prisma.TransactionClient,
      challenge: Awaited<ReturnType<Prisma.TransactionClient['positiveChallenge']['findUniqueOrThrow']>>
    ) => Promise<{ challenge: any; replayed: boolean }>
  ) {
    for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const challenge = await tx.positiveChallenge.findUnique({ where: { id: challengeId } });
            if (!challenge) throw new NotFoundException('Positive Challenge introuvable.');
            return action(tx, challenge as any);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isRetryableTransaction(error) && attempt < TRANSACTION_ATTEMPTS - 1) {
          await this.backoff(attempt);
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('Transition temporairement indisponible.');
  }

  private async expireInTransaction(tx: Prisma.TransactionClient, challenge: any) {
    const updated = await tx.positiveChallenge.update({
      where: { id: challenge.id },
      data: { status: 'EXPIRED' }
    });
    await tx.positiveChallengeEvent.upsert({
      where: { idempotencyKey: `positive:${challenge.id}:EXPIRED` },
      create: {
        challengeId: challenge.id,
        actorId: 'SYSTEM',
        type: 'EXPIRED',
        idempotencyKey: `positive:${challenge.id}:EXPIRED`,
        metadata: { noPenalty: true }
      },
      update: {}
    });
    return { challenge: updated, replayed: false };
  }

  private async expireOutstanding(userId: string) {
    const expired = await this.prisma.positiveChallenge.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: ACTIVE_STATUSES },
        OR: [{ creatorId: userId }, { recipientId: userId }]
      },
      select: { id: true }
    });
    if (!expired.length) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.positiveChallenge.updateMany({
        where: { id: { in: expired.map((item) => item.id) }, status: { in: ACTIVE_STATUSES } },
        data: { status: 'EXPIRED' }
      });
      await tx.positiveChallengeEvent.createMany({
        data: expired.map((item) => ({
          challengeId: item.id,
          actorId: 'SYSTEM',
          type: 'EXPIRED',
          idempotencyKey: `positive:${item.id}:EXPIRED`,
          metadata: { noPenalty: true }
        })),
        skipDuplicates: true
      });
    });
  }

  private async assertAcceptedFriendship(firstId: string, secondId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: firstId, addresseeId: secondId },
          { requesterId: secondId, addresseeId: firstId }
        ]
      },
      select: { id: true }
    });
    if (!friendship) {
      throw new ForbiddenException('Les Positive Challenges sont réservés aux amis acceptés.');
    }
  }

  private publicChallenge(challenge: any) {
    const kind = challenge.kind as PositiveChallengeKind;
    return {
      id: challenge.id,
      kind,
      title: CATALOG[kind]?.title ?? kind,
      description: CATALOG[kind]?.description ?? '',
      note: challenge.note,
      creatorId: challenge.creatorId,
      recipientId: challenge.recipientId,
      status: challenge.status,
      challengeDate: challenge.challengeDate,
      acceptedAt: challenge.acceptedAt,
      declinedAt: challenge.declinedAt,
      cancelledAt: challenge.cancelledAt,
      creatorConfirmedAt: challenge.creatorConfirmedAt,
      recipientConfirmedAt: challenge.recipientConfirmedAt,
      completedAt: challenge.completedAt,
      expiresAt: challenge.expiresAt,
      createdAt: challenge.createdAt,
      updatedAt: challenge.updatedAt,
      events: challenge.events ?? []
    };
  }

  private rules() {
    return {
      friendsOnly: true,
      explicitConsent: true,
      refusalPenalty: false,
      cancellationPenalty: false,
      doubleConfirmation: true,
      reward: null,
      paidBoostsAllowed: false,
      sensitiveDataRequired: false,
      maximumDailyInvitations: MAX_DAILY_INVITATIONS,
      maximumActivePerPair: MAX_ACTIVE_PER_PAIR,
      expirationHours: EXPIRATION_HOURS
    };
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isRetryableTransaction(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private async backoff(attempt: number) {
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
}
