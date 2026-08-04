import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  TooManyRequestsException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTournamentEntrantDto } from './dto/register-tournament-entrant.dto';
import { ResolveTournamentMatchDto } from './dto/resolve-tournament-match.dto';
import { TournamentOperationDto } from './dto/tournament-operation.dto';
import { GameEngineRegistry } from './game-engine.registry';
import { sha256Json } from './game-platform.domain';

type Tx = Prisma.TransactionClient;

type TournamentRecord = {
  id: string;
  ownerId: string;
  gameDefinitionId: string;
  gameDefinitionKey: string;
  gameDefinitionVersion: number;
  teamSize: number;
  maxEntrants: number;
  status: string;
  registrationClosesAt: Date;
  version: number;
};

type MatchRecord = {
  id: string;
  tournamentId: string;
  firstEntrantId: string | null;
  secondEntrantId: string | null;
  winnerEntrantId: string | null;
  gameSessionId: string | null;
  status: string;
  nextMatchId: string | null;
  nextSlot: 'FIRST' | 'SECOND' | null;
  version: number;
};

const MAX_ACTIONS_PER_DAY = 24;
const MAX_REGISTRATION_HORIZON_MS = 90 * 24 * 60 * 60 * 1_000;
const MIN_REGISTRATION_WINDOW_MS = 5 * 60 * 1_000;
const ACTIVE_MATCH_STATUSES = ['PENDING', 'WAITING', 'ACTIVE', 'REVIEW_REQUIRED'];

@Injectable()
export class TournamentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: GameEngineRegistry,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async create(userId: string, dto: CreateTournamentDto) {
    const receipt = await this.receipt(userId, dto.idempotencyKey);
    if (receipt) {
      const tournamentId = this.receiptTournamentId(receipt.response);
      return { ...(await this.view(userId, tournamentId)), replayed: true };
    }
    await this.assertRateLimit(userId);
    this.assertPowerOfTwo(dto.maxEntrants);

    const closesAt = new Date(dto.registrationClosesAt);
    const now = Date.now();
    if (
      closesAt.getTime() < now + MIN_REGISTRATION_WINDOW_MS ||
      closesAt.getTime() > now + MAX_REGISTRATION_HORIZON_MS
    ) {
      throw new BadRequestException({
        code: 'TOURNAMENT_REGISTRATION_WINDOW_INVALID',
        message: 'La clôture des inscriptions doit être comprise entre cinq minutes et quatre-vingt-dix jours.'
      });
    }

    const [definition, owner] = await Promise.all([
      this.registry.latestActive(dto.gameKey),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isSuspended: true }
      })
    ]);
    if (!definition) throw this.gameUnavailable();
    if (!owner || owner.isSuspended) throw this.accountIneligible();
    if (definition.minPlayers > 2 || definition.maxPlayers < 2) {
      throw new BadRequestException({
        code: 'TOURNAMENT_GAME_REQUIRES_DUEL',
        message: 'KMD-056 accepte uniquement les jeux autoritaires compatibles avec deux joueurs.'
      });
    }

    const tournamentId = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return this.receiptTournamentId(duplicate.response);

      const tournament = await tx.tournament.create({
        data: {
          ownerId: userId,
          creationKey: dto.idempotencyKey,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          gameDefinitionId: definition.id,
          gameDefinitionKey: definition.key,
          gameDefinitionVersion: definition.version,
          format: 'SINGLE_ELIMINATION',
          teamSize: dto.teamSize,
          maxEntrants: dto.maxEntrants,
          registrationClosesAt: closesAt
        }
      });
      await tx.tournamentEvent.create({
        data: {
          tournamentId: tournament.id,
          actorId: userId,
          action: 'TOURNAMENT_CREATED',
          metadata: this.json({
            gameKey: definition.key,
            gameVersion: definition.version,
            teamSize: dto.teamSize,
            maxEntrants: dto.maxEntrants,
            economicStake: false
          })
        }
      });
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'CREATE_TOURNAMENT',
        tournament.id
      );
      return tournament.id;
    });

    await this.audit.record({
      actorId: userId,
      action: 'TOURNAMENT_CREATED',
      entity: 'Tournament',
      entityId: tournamentId,
      metadata: {
        gameKey: definition.key,
        teamSize: dto.teamSize,
        maxEntrants: dto.maxEntrants,
        format: 'SINGLE_ELIMINATION',
        economicStake: false
      }
    });
    return { ...(await this.view(userId, tournamentId)), replayed: false };
  }

  async openRegistration(
    userId: string,
    tournamentId: string,
    dto: TournamentOperationDto
  ) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.view(userId, tournamentId)), replayed: true };

    const changed = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return false;

      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      this.assertOwner(tournament, userId);
      if (tournament.status !== 'DRAFT') {
        throw new ConflictException({
          code: 'TOURNAMENT_REGISTRATION_ALREADY_DECIDED',
          message: 'Les inscriptions de ce tournoi ne peuvent plus être ouvertes.'
        });
      }
      if (tournament.registrationClosesAt <= new Date()) {
        throw new ConflictException({
          code: 'TOURNAMENT_REGISTRATION_CLOSED',
          message: 'La date de clôture des inscriptions est dépassée.'
        });
      }
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'REGISTRATION_OPEN', version: { increment: 1 } }
      });
      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId: userId,
          action: 'REGISTRATION_OPENED'
        }
      });
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'OPEN_REGISTRATION',
        tournamentId
      );
      return true;
    });

    return { ...(await this.view(userId, tournamentId)), replayed: !changed };
  }

  async registerEntrant(
    userId: string,
    tournamentId: string,
    dto: RegisterTournamentEntrantDto
  ) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.view(userId, tournamentId)), replayed: true };
    await this.assertRateLimit(userId);

    const normalizedUsernames = [
      ...new Set(dto.memberUsernames.map((value) => value.trim().toLowerCase()))
    ];
    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
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
          entrantId: null as string | null,
          invitedUserIds: [] as string[]
        };
      }

      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw this.notFound();
      if (
        tournament.status !== 'REGISTRATION_OPEN' ||
        tournament.registrationClosesAt <= new Date()
      ) {
        throw new ConflictException({
          code: 'TOURNAMENT_REGISTRATION_CLOSED',
          message: 'Les inscriptions de ce tournoi sont fermées.'
        });
      }
      if (normalizedUsernames.length !== tournament.teamSize - 1) {
        throw new BadRequestException({
          code: 'TOURNAMENT_TEAM_SIZE_INVALID',
          message: `Cette inscription exige exactement ${tournament.teamSize} membre(s), capitaine compris.`
        });
      }
      if (tournament.teamSize > 1 && !dto.teamName?.trim()) {
        throw new BadRequestException({
          code: 'TOURNAMENT_TEAM_NAME_REQUIRED',
          message: 'Un nom d’équipe est obligatoire.'
        });
      }

      const activeEntrants = await tx.tournamentEntrant.count({
        where: {
          tournamentId,
          status: { in: ['PENDING', 'READY'] }
        }
      });
      if (activeEntrants >= tournament.maxEntrants) {
        throw new ConflictException({
          code: 'TOURNAMENT_CAPACITY_REACHED',
          message: 'Le tournoi a atteint sa capacité maximale.'
        });
      }

      const captain = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true, isSuspended: true }
      });
      if (!captain || captain.isSuspended) throw this.accountIneligible();
      if (normalizedUsernames.includes(captain.username.toLowerCase())) {
        throw new BadRequestException({
          code: 'TOURNAMENT_SELF_INVITATION_FORBIDDEN',
          message: 'Le capitaine ne doit pas être ajouté une seconde fois.'
        });
      }

      const invitees = normalizedUsernames.length
        ? await tx.user.findMany({
            where: {
              username: { in: normalizedUsernames, mode: 'insensitive' },
              isSuspended: false
            },
            select: { id: true, username: true, displayName: true }
          })
        : [];
      if (invitees.length !== normalizedUsernames.length) {
        throw new NotFoundException({
          code: 'TOURNAMENT_MEMBER_NOT_FOUND',
          message: 'Au moins un membre est introuvable ou indisponible.'
        });
      }
      const allUserIds = [userId, ...invitees.map((invitee) => invitee.id)];
      const existingMembership = await tx.tournamentEntrantMember.findFirst({
        where: { tournamentId, userId: { in: allUserIds } },
        select: { userId: true }
      });
      if (existingMembership) {
        throw new ConflictException({
          code: 'TOURNAMENT_MEMBER_ALREADY_REGISTERED',
          message: 'Un membre appartient déjà à une inscription de ce tournoi.'
        });
      }

      const entrant = await tx.tournamentEntrant.create({
        data: {
          tournamentId,
          captainId: userId,
          name:
            tournament.teamSize === 1
              ? captain.displayName
              : (dto.teamName as string).trim(),
          status: tournament.teamSize === 1 ? 'READY' : 'PENDING'
        }
      });
      await tx.tournamentEntrantMember.createMany({
        data: [
          {
            tournamentId,
            entrantId: entrant.id,
            userId,
            role: 'CAPTAIN',
            status: 'JOINED',
            joinedAt: new Date()
          },
          ...invitees.map((invitee) => ({
            tournamentId,
            entrantId: entrant.id,
            userId: invitee.id,
            role: 'MEMBER' as const,
            status: 'INVITED' as const
          }))
        ]
      });
      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId: userId,
          action: 'ENTRANT_REGISTERED',
          subjectId: entrant.id,
          metadata: this.json({
            teamSize: tournament.teamSize,
            invitedCount: invitees.length
          })
        }
      });
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'REGISTER_ENTRANT',
        tournamentId
      );
      return {
        replayed: false,
        entrantId: entrant.id,
        invitedUserIds: invitees.map((invitee) => invitee.id)
      };
    });

    if (!result.replayed && result.entrantId && result.invitedUserIds.length) {
      await this.notifications.createMany(
        result.invitedUserIds.map((recipientId) => ({
          userId: recipientId,
          type: 'TOURNAMENT_TEAM_INVITATION',
          title: 'Invitation à une équipe de tournoi',
          body: 'Un capitaine souhaite t’inscrire dans son équipe.',
          data: {
            route: `/tournaments/${tournamentId}`,
            entityType: 'TOURNAMENT_ENTRANT',
            entityId: result.entrantId as string,
            actorId: userId
          }
        }))
      );
    }
    return { ...(await this.view(userId, tournamentId)), replayed: result.replayed };
  }

  async acceptInvitation(
    userId: string,
    tournamentId: string,
    dto: TournamentOperationDto
  ) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.view(userId, tournamentId)), replayed: true };

    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return { replayed: true, captainId: null as string | null };

      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (
        !tournament ||
        tournament.status !== 'REGISTRATION_OPEN' ||
        tournament.registrationClosesAt <= new Date()
      ) {
        throw new ConflictException({
          code: 'TOURNAMENT_REGISTRATION_CLOSED',
          message: 'Cette invitation n’est plus disponible.'
        });
      }
      const member = await tx.tournamentEntrantMember.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } }
      });
      if (!member) throw this.notMember();
      if (member.status === 'JOINED') {
        await this.writeReceipt(
          tx,
          userId,
          dto.idempotencyKey,
          'ACCEPT_TEAM_INVITATION',
          tournamentId
        );
        return { replayed: true, captainId: null as string | null };
      }
      if (member.status !== 'INVITED') {
        throw new ConflictException({
          code: 'TOURNAMENT_INVITATION_CLOSED',
          message: 'Cette invitation ne peut plus être acceptée.'
        });
      }
      await tx.tournamentEntrantMember.update({
        where: { tournamentId_userId: { tournamentId, userId } },
        data: { status: 'JOINED', joinedAt: new Date(), leftAt: null }
      });
      const remaining = await tx.tournamentEntrantMember.count({
        where: { entrantId: member.entrantId, status: 'INVITED' }
      });
      let captainId: string | null = null;
      if (remaining === 0) {
        const entrant = await tx.tournamentEntrant.update({
          where: { id: member.entrantId },
          data: { status: 'READY' }
        });
        captainId = entrant.captainId;
      }
      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId: userId,
          action: 'TEAM_INVITATION_ACCEPTED',
          subjectId: member.entrantId
        }
      });
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'ACCEPT_TEAM_INVITATION',
        tournamentId
      );
      return { replayed: false, captainId };
    });

    if (result.captainId) {
      await this.notifications.create({
        userId: result.captainId,
        type: 'TOURNAMENT_TEAM_READY',
        title: 'Équipe prête',
        body: 'Tous les membres ont accepté l’inscription au tournoi.',
        data: {
          route: `/tournaments/${tournamentId}`,
          entityType: 'TOURNAMENT',
          entityId: tournamentId
        }
      });
    }
    return { ...(await this.view(userId, tournamentId)), replayed: result.replayed };
  }

  async withdraw(
    userId: string,
    tournamentId: string,
    dto: TournamentOperationDto
  ) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.view(userId, tournamentId)), replayed: true };

    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return { replayed: true, advanced: false };

      const [tournament, member] = await Promise.all([
        tx.tournament.findUnique({ where: { id: tournamentId } }),
        tx.tournamentEntrantMember.findUnique({
          where: { tournamentId_userId: { tournamentId, userId } }
        })
      ]);
      if (!tournament) throw this.notFound();
      if (!member || member.status === 'LEFT') throw this.notMember();
      if (['COMPLETED', 'CANCELLED'].includes(tournament.status)) {
        throw new ConflictException({
          code: 'TOURNAMENT_ALREADY_TERMINAL',
          message: 'Ce tournoi est déjà terminé.'
        });
      }

      let advanced = false;
      if (tournament.status === 'ACTIVE') {
        advanced = await this.forfeitEntrantTx(
          tx,
          tournamentId,
          member.entrantId,
          userId,
          'USER_WITHDREW'
        );
      } else {
        await tx.tournamentEntrant.updateMany({
          where: {
            id: member.entrantId,
            status: { in: ['PENDING', 'READY'] }
          },
          data: { status: 'WITHDRAWN', withdrawnAt: new Date() }
        });
        await tx.tournamentEntrantMember.updateMany({
          where: { entrantId: member.entrantId, status: { not: 'LEFT' } },
          data: { status: 'LEFT', leftAt: new Date() }
        });
      }
      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId: userId,
          action: 'ENTRANT_WITHDREW',
          subjectId: member.entrantId,
          metadata: this.json({ advancedOpponent: advanced })
        }
      });
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'WITHDRAW_ENTRANT',
        tournamentId
      );
      return { replayed: false, advanced };
    });

    return { ...(await this.view(userId, tournamentId)), replayed: result.replayed };
  }

  async start(
    userId: string,
    tournamentId: string,
    dto: TournamentOperationDto
  ) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.view(userId, tournamentId)), replayed: true };

    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return { replayed: true, participantIds: [] as string[] };

      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      this.assertOwner(tournament, userId);
      if (tournament.status !== 'REGISTRATION_OPEN') {
        throw new ConflictException({
          code: 'TOURNAMENT_START_NOT_ALLOWED',
          message: 'Ce tournoi ne peut pas être démarré.'
        });
      }

      const activeEntrants = await tx.tournamentEntrant.findMany({
        where: {
          tournamentId,
          status: { in: ['PENDING', 'READY'] }
        },
        orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }]
      });
      const readyEntrants = activeEntrants.filter((entrant) => entrant.status === 'READY');
      if (activeEntrants.some((entrant) => entrant.status === 'PENDING')) {
        throw new ConflictException({
          code: 'TOURNAMENT_TEAMS_NOT_READY',
          message: 'Toutes les invitations d’équipe doivent être acceptées ou retirées.'
        });
      }
      if (readyEntrants.length < 2 || !this.isPowerOfTwo(readyEntrants.length)) {
        throw new ConflictException({
          code: 'TOURNAMENT_BRACKET_SIZE_INVALID',
          message: 'Le nombre d’inscriptions prêtes doit être une puissance de deux comprise entre 2 et 32.'
        });
      }
      if (
        tournament.registrationClosesAt > new Date() &&
        readyEntrants.length < tournament.maxEntrants
      ) {
        throw new ConflictException({
          code: 'TOURNAMENT_REGISTRATION_STILL_OPEN',
          message: 'Le tournoi peut démarrer avant la clôture uniquement lorsque sa capacité est atteinte.'
        });
      }

      const definition = await tx.gameDefinition.findUnique({
        where: { id: tournament.gameDefinitionId }
      });
      if (!definition || definition.status !== 'ACTIVE') throw this.gameUnavailable();
      const bracketSeed = randomBytes(32).toString('hex');
      const seeded = [...readyEntrants].sort((left, right) =>
        this.seedKey(bracketSeed, left.id).localeCompare(
          this.seedKey(bracketSeed, right.id)
        )
      );
      for (let index = 0; index < seeded.length; index += 1) {
        await tx.tournamentEntrant.update({
          where: { id: seeded[index].id },
          data: { seed: index + 1 }
        });
      }

      const rounds = Math.log2(seeded.length);
      const roundMatches: Array<Array<{ id: string }>> = [];
      for (let round = 1; round <= rounds; round += 1) {
        const count = seeded.length / 2 ** round;
        const items: Array<{ id: string }> = [];
        for (let position = 0; position < count; position += 1) {
          items.push(
            await tx.tournamentMatch.create({
              data: { tournamentId, round, position, status: 'PENDING' },
              select: { id: true }
            })
          );
        }
        roundMatches.push(items);
      }
      for (let roundIndex = 0; roundIndex < roundMatches.length - 1; roundIndex += 1) {
        for (let position = 0; position < roundMatches[roundIndex].length; position += 1) {
          await tx.tournamentMatch.update({
            where: { id: roundMatches[roundIndex][position].id },
            data: {
              nextMatchId: roundMatches[roundIndex + 1][Math.floor(position / 2)].id,
              nextSlot: position % 2 === 0 ? 'FIRST' : 'SECOND'
            }
          });
        }
      }

      for (let position = 0; position < roundMatches[0].length; position += 1) {
        const first = seeded[position * 2];
        const second = seeded[position * 2 + 1];
        const matchId = roundMatches[0][position].id;
        await tx.tournamentMatch.update({
          where: { id: matchId },
          data: { firstEntrantId: first.id, secondEntrantId: second.id }
        });
        await this.createMatchSessionTx(
          tx,
          tournament,
          definition,
          matchId,
          first.id,
          second.id
        );
      }

      const changed = await tx.tournament.updateMany({
        where: {
          id: tournamentId,
          status: 'REGISTRATION_OPEN',
          version: tournament.version
        },
        data: {
          status: 'ACTIVE',
          bracketSeed,
          bracketSize: seeded.length,
          startedAt: new Date(),
          version: { increment: 1 }
        }
      });
      if (changed.count !== 1) throw this.conflict();

      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId: userId,
          action: 'TOURNAMENT_STARTED',
          metadata: this.json({
            bracketSize: seeded.length,
            rounds,
            serverSeeded: true,
            economicStake: false
          })
        }
      });
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'START_TOURNAMENT',
        tournamentId
      );
      const participantIds = await tx.tournamentEntrantMember.findMany({
        where: {
          tournamentId,
          entrantId: { in: seeded.map((entrant) => entrant.id) },
          status: 'JOINED'
        },
        select: { userId: true }
      });
      return {
        replayed: false,
        participantIds: participantIds.map((item) => item.userId)
      };
    });

    if (!result.replayed && result.participantIds.length) {
      await this.notifications.createMany(
        result.participantIds.map((recipientId) => ({
          userId: recipientId,
          type: 'TOURNAMENT_STARTED',
          title: 'Le tournoi commence',
          body: 'Le bracket a été généré par le serveur. Les capitaines peuvent rejoindre leur première partie.',
          data: {
            route: `/tournaments/${tournamentId}`,
            entityType: 'TOURNAMENT',
            entityId: tournamentId
          }
        }))
      );
    }
    await this.audit.record({
      actorId: userId,
      action: 'TOURNAMENT_STARTED',
      entity: 'Tournament',
      entityId: tournamentId,
      metadata: { economicStake: false, resultSource: 'GAME_PLATFORM' }
    });
    return { ...(await this.view(userId, tournamentId)), replayed: result.replayed };
  }

  async syncMatch(userId: string, tournamentId: string, matchId: string) {
    await this.assertViewer(userId, tournamentId);
    const result = await this.serializable((tx) =>
      this.syncMatchTx(tx, tournamentId, matchId, userId)
    );
    if (result.advanced && result.winnerUserIds.length) {
      await this.notifications.createMany(
        result.winnerUserIds.map((recipientId) => ({
          userId: recipientId,
          type: result.tournamentCompleted
            ? 'TOURNAMENT_CHAMPION'
            : 'TOURNAMENT_ADVANCED',
          title: result.tournamentCompleted ? 'Tournoi remporté' : 'Qualification confirmée',
          body: result.tournamentCompleted
            ? 'Ton équipe remporte le tournoi.'
            : 'Le résultat autoritaire de la partie te qualifie pour le tour suivant.',
          data: {
            route: `/tournaments/${tournamentId}`,
            entityType: 'TOURNAMENT_MATCH',
            entityId: matchId
          }
        }))
      );
    }
    return this.view(userId, tournamentId);
  }

  async syncDue(limit = 100) {
    const candidates = await this.prisma.tournamentMatch.findMany({
      where: {
        status: { in: ['WAITING', 'ACTIVE'] },
        gameSessionId: { not: null }
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(500, Math.max(1, limit)),
      select: { id: true, tournamentId: true }
    });
    let advanced = 0;
    let reviewRequired = 0;
    for (const candidate of candidates) {
      const result = await this.serializable((tx) =>
        this.syncMatchTx(tx, candidate.tournamentId, candidate.id, 'system:tournament-maintenance')
      );
      if (result.advanced) advanced += 1;
      if (result.reviewRequired) reviewRequired += 1;
    }
    return {
      inspectedTournamentMatches: candidates.length,
      advancedTournamentMatches: advanced,
      tournamentMatchesRequiringReview: reviewRequired
    };
  }

  async cancel(
    userId: string,
    tournamentId: string,
    dto: TournamentOperationDto
  ) {
    const replay = await this.receipt(userId, dto.idempotencyKey);
    if (replay) return { ...(await this.view(userId, tournamentId)), replayed: true };

    const changed = await this.serializable(async (tx) => {
      const duplicate = await tx.tournamentReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (duplicate) return false;
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      this.assertOwner(tournament, userId);
      if (tournament.status === 'ACTIVE') {
        throw new ConflictException({
          code: 'TOURNAMENT_ADMIN_REQUIRED',
          message: 'Un tournoi démarré doit être traité par la modération.'
        });
      }
      if (['COMPLETED', 'CANCELLED'].includes(tournament.status)) {
        await this.writeReceipt(
          tx,
          userId,
          dto.idempotencyKey,
          'CANCEL_TOURNAMENT',
          tournamentId
        );
        return false;
      }
      await this.cancelTournamentTx(tx, tournamentId, userId, 'OWNER_CANCELLED');
      await this.writeReceipt(
        tx,
        userId,
        dto.idempotencyKey,
        'CANCEL_TOURNAMENT',
        tournamentId
      );
      return true;
    });
    return { ...(await this.view(userId, tournamentId)), replayed: !changed };
  }

  async resolveMatch(
    actorId: string,
    tournamentId: string,
    matchId: string,
    dto: ResolveTournamentMatchDto
  ) {
    const result = await this.serializable(async (tx) => {
      const match = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
      if (!match || match.tournamentId !== tournamentId) throw this.matchNotFound();
      if (match.status !== 'REVIEW_REQUIRED') {
        throw new ConflictException({
          code: 'TOURNAMENT_MATCH_NOT_REVIEWABLE',
          message: 'Seuls les matchs marqués pour examen peuvent être résolus manuellement.'
        });
      }
      if (![match.firstEntrantId, match.secondEntrantId].includes(dto.winnerEntrantId)) {
        throw new BadRequestException({
          code: 'TOURNAMENT_WINNER_INVALID',
          message: 'Le gagnant doit être l’un des deux entrants du match.'
        });
      }
      const advanced = await this.advanceWinnerTx(
        tx,
        match as MatchRecord,
        dto.winnerEntrantId,
        actorId,
        `ADMIN_RESOLUTION:${dto.reason.trim()}`,
        'COMPLETED'
      );
      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId,
          action: 'MATCH_RESOLVED_BY_MODERATION',
          subjectId: matchId,
          metadata: this.json({
            winnerEntrantId: dto.winnerEntrantId,
            reason: dto.reason.trim(),
            gameResultOverridden: false,
            reviewRequired: true
          })
        }
      });
      return advanced;
    });

    await this.audit.record({
      actorId,
      action: 'TOURNAMENT_MATCH_RESOLVED',
      entity: 'TournamentMatch',
      entityId: matchId,
      metadata: {
        tournamentId,
        winnerEntrantId: dto.winnerEntrantId,
        reason: dto.reason.trim()
      }
    });
    return { tournamentId, matchId, ...result };
  }

  async governCancel(actorId: string, tournamentId: string, reason: string) {
    const changed = await this.serializable(async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw this.notFound();
      if (['COMPLETED', 'CANCELLED'].includes(tournament.status)) return false;
      await this.cancelTournamentTx(
        tx,
        tournamentId,
        actorId,
        `ADMIN:${reason.trim()}`
      );
      return true;
    });
    await this.audit.record({
      actorId,
      action: 'TOURNAMENT_GOVERNED',
      entity: 'Tournament',
      entityId: tournamentId,
      metadata: { action: 'CANCEL', reason: reason.trim(), changed }
    });
    return { tournamentId, changed };
  }

  async listOpen() {
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        status: 'REGISTRATION_OPEN',
        registrationClosesAt: { gt: new Date() }
      },
      orderBy: [{ registrationClosesAt: 'asc' }, { id: 'asc' }],
      take: 100
    });
    return Promise.all(tournaments.map((item) => this.summary(item.id)));
  }

  async listMine(userId: string) {
    const [owned, memberships] = await Promise.all([
      this.prisma.tournament.findMany({
        where: { ownerId: userId },
        select: { id: true }
      }),
      this.prisma.tournamentEntrantMember.findMany({
        where: { userId },
        select: { tournamentId: true }
      })
    ]);
    const ids = [
      ...new Set([
        ...owned.map((item) => item.id),
        ...memberships.map((item) => item.tournamentId)
      ])
    ];
    if (!ids.length) return [];
    const tournaments = await this.prisma.tournament.findMany({
      where: { id: { in: ids } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true }
    });
    return Promise.all(tournaments.map((item) => this.summary(item.id)));
  }

  async view(userId: string, tournamentId: string) {
    const [tournament, entrants, members, matches] = await Promise.all([
      this.prisma.tournament.findUnique({ where: { id: tournamentId } }),
      this.prisma.tournamentEntrant.findMany({
        where: { tournamentId },
        orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }, { id: 'asc' }]
      }),
      this.prisma.tournamentEntrantMember.findMany({
        where: { tournamentId },
        orderBy: [{ entrantId: 'asc' }, { role: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.tournamentMatch.findMany({
        where: { tournamentId },
        orderBy: [{ round: 'asc' }, { position: 'asc' }]
      })
    ]);
    if (!tournament) throw this.notFound();

    const userIds = [...new Set(members.map((member) => member.userId))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        })
      : [];
    const sessionIds = matches
      .map((match) => match.gameSessionId)
      .filter((value): value is string => Boolean(value));
    const sessions = sessionIds.length
      ? await this.prisma.gameSession.findMany({
          where: { id: { in: sessionIds } },
          select: {
            id: true,
            status: true,
            winnerUserId: true,
            startedAt: true,
            completedAt: true,
            updatedAt: true
          }
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));
    const membersByEntrant = new Map<string, typeof members>();
    for (const member of members) {
      const collection = membersByEntrant.get(member.entrantId) ?? [];
      collection.push(member);
      membersByEntrant.set(member.entrantId, collection);
    }
    const viewerMember = members.find((member) => member.userId === userId) ?? null;

    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      game: {
        key: tournament.gameDefinitionKey,
        version: tournament.gameDefinitionVersion
      },
      format: tournament.format,
      teamSize: tournament.teamSize,
      maxEntrants: tournament.maxEntrants,
      status: tournament.status,
      bracketSize: tournament.bracketSize,
      championEntrantId: tournament.championEntrantId,
      registrationClosesAt: tournament.registrationClosesAt,
      startedAt: tournament.startedAt,
      completedAt: tournament.completedAt,
      cancelledAt: tournament.cancelledAt,
      cancellationReason: tournament.cancellationReason,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
      viewer: {
        owner: tournament.ownerId === userId,
        member: Boolean(viewerMember),
        entrantId: viewerMember?.entrantId ?? null,
        invitationPending: viewerMember?.status === 'INVITED',
        captain: viewerMember?.role === 'CAPTAIN'
      },
      entrants: entrants.map((entrant) => ({
        id: entrant.id,
        name: entrant.name,
        seed: entrant.seed,
        status: entrant.status,
        captainId: entrant.captainId,
        registeredAt: entrant.registeredAt,
        members: (membersByEntrant.get(entrant.id) ?? []).map((member) => ({
          userId: member.userId,
          role: member.role,
          status: member.status,
          user: userMap.get(member.userId) ?? null
        }))
      })),
      matches: matches.map((match) => ({
        id: match.id,
        round: match.round,
        position: match.position,
        firstEntrantId: match.firstEntrantId,
        secondEntrantId: match.secondEntrantId,
        winnerEntrantId: match.winnerEntrantId,
        status: match.status,
        nextMatchId: match.nextMatchId,
        nextSlot: match.nextSlot,
        gameSessionId: match.gameSessionId,
        gameSession: match.gameSessionId
          ? sessionMap.get(match.gameSessionId) ?? null
          : null,
        resolutionReason: match.resolutionReason,
        startedAt: match.startedAt,
        completedAt: match.completedAt
      })),
      policy: {
        serverAuthoritative: true,
        clientWinnerAccepted: false,
        clientScoreAccepted: false,
        economicStakeAllowed: false,
        paidPriorityAllowed: false,
        captainRepresentsTeam: true,
        bracketSeedExposed: false
      }
    };
  }

  async operations(status?: string) {
    const normalized = status?.toUpperCase();
    const allowed = ['DRAFT', 'REGISTRATION_OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
    const [counts, tournaments, reviewMatches] = await Promise.all([
      this.prisma.tournament.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.tournament.findMany({
        where:
          normalized && allowed.includes(normalized)
            ? { status: normalized as never }
            : undefined,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: {
          id: true,
          ownerId: true,
          name: true,
          gameDefinitionKey: true,
          gameDefinitionVersion: true,
          teamSize: true,
          maxEntrants: true,
          status: true,
          registrationClosesAt: true,
          startedAt: true,
          completedAt: true,
          cancellationReason: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.tournamentMatch.findMany({
        where: { status: 'REVIEW_REQUIRED' },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 100
      })
    ]);
    return {
      counts: Object.fromEntries(counts.map((item) => [item.status, item._count._all])),
      tournaments,
      reviewMatches,
      policy: {
        economicStakeEnabled: false,
        resultSource: 'GAME_PLATFORM',
        manualResolutionOnlyWhenReviewRequired: true
      }
    };
  }

  async exportForAccount(userId: string) {
    const memberships = await this.prisma.tournamentEntrantMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    const owned = await this.prisma.tournament.findMany({
      where: { ownerId: userId },
      select: { id: true }
    });
    const tournamentIds = [
      ...new Set([
        ...memberships.map((item) => item.tournamentId),
        ...owned.map((item) => item.id)
      ])
    ];
    const [tournaments, entrants, matches, events] = await Promise.all([
      tournamentIds.length
        ? this.prisma.tournament.findMany({
            where: { id: { in: tournamentIds } },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              description: true,
              gameDefinitionKey: true,
              gameDefinitionVersion: true,
              format: true,
              teamSize: true,
              maxEntrants: true,
              status: true,
              bracketSize: true,
              championEntrantId: true,
              registrationClosesAt: true,
              startedAt: true,
              completedAt: true,
              cancelledAt: true,
              cancellationReason: true,
              createdAt: true,
              updatedAt: true
            }
          })
        : [],
      tournamentIds.length
        ? this.prisma.tournamentEntrant.findMany({
            where: { tournamentId: { in: tournamentIds } },
            orderBy: { registeredAt: 'desc' },
            select: {
              id: true,
              tournamentId: true,
              name: true,
              seed: true,
              status: true,
              registeredAt: true,
              withdrawnAt: true,
              eliminatedAt: true
            }
          })
        : [],
      tournamentIds.length
        ? this.prisma.tournamentMatch.findMany({
            where: { tournamentId: { in: tournamentIds } },
            orderBy: [{ tournamentId: 'asc' }, { round: 'asc' }, { position: 'asc' }],
            select: {
              id: true,
              tournamentId: true,
              round: true,
              position: true,
              firstEntrantId: true,
              secondEntrantId: true,
              winnerEntrantId: true,
              gameSessionId: true,
              status: true,
              resolutionReason: true,
              startedAt: true,
              completedAt: true
            }
          })
        : [],
      this.prisma.tournamentEvent.findMany({
        where: { actorId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          tournamentId: true,
          action: true,
          subjectId: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);
    return {
      formatVersion: 1,
      economicStakeIncluded: false,
      bracketSeedIncluded: false,
      clientSubmittedResultsIncluded: false,
      memberships,
      tournaments,
      entrants,
      matches,
      authoredEvents: events
    };
  }

  async deleteForAccount(userId: string, tx: Tx) {
    const memberships = await tx.tournamentEntrantMember.findMany({
      where: { userId }
    });
    const owned = await tx.tournament.findMany({
      where: { ownerId: userId }
    });
    const tombstone = `deleted-${randomUUID()}`;

    for (const tournament of owned) {
      if (['DRAFT', 'REGISTRATION_OPEN'].includes(tournament.status)) {
        await this.cancelTournamentTx(
          tx,
          tournament.id,
          userId,
          'ACCOUNT_DELETED'
        );
      }
    }
    for (const membership of memberships) {
      const [tournament, entrant] = await Promise.all([
        tx.tournament.findUnique({ where: { id: membership.tournamentId } }),
        tx.tournamentEntrant.findUnique({ where: { id: membership.entrantId } })
      ]);
      if (!tournament || !entrant) continue;
      if (membership.role === 'CAPTAIN' && tournament.status === 'ACTIVE') {
        await this.forfeitEntrantTx(
          tx,
          tournament.id,
          entrant.id,
          userId,
          'ACCOUNT_DELETED'
        );
      } else if (
        ['DRAFT', 'REGISTRATION_OPEN'].includes(tournament.status) &&
        ['PENDING', 'READY'].includes(entrant.status)
      ) {
        await tx.tournamentEntrant.update({
          where: { id: entrant.id },
          data: { status: 'WITHDRAWN', withdrawnAt: new Date() }
        });
      }
    }

    await tx.tournamentReceipt.deleteMany({ where: { userId } });
    await tx.tournamentEvent.updateMany({
      where: { actorId: userId },
      data: { actorId: tombstone }
    });
    await tx.tournamentEvent.updateMany({
      where: { subjectId: userId },
      data: { subjectId: tombstone }
    });
    await tx.tournamentEntrantMember.deleteMany({ where: { userId } });
    await tx.tournamentEntrant.updateMany({
      where: { captainId: userId },
      data: { captainId: tombstone }
    });
    await tx.tournament.updateMany({
      where: { ownerId: userId },
      data: { ownerId: tombstone }
    });
  }

  private async summary(tournamentId: string) {
    const [tournament, counts] = await Promise.all([
      this.prisma.tournament.findUnique({ where: { id: tournamentId } }),
      this.prisma.tournamentEntrant.groupBy({
        by: ['status'],
        where: { tournamentId },
        _count: { _all: true }
      })
    ]);
    if (!tournament) throw this.notFound();
    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      game: {
        key: tournament.gameDefinitionKey,
        version: tournament.gameDefinitionVersion
      },
      format: tournament.format,
      teamSize: tournament.teamSize,
      maxEntrants: tournament.maxEntrants,
      status: tournament.status,
      registrationClosesAt: tournament.registrationClosesAt,
      startedAt: tournament.startedAt,
      completedAt: tournament.completedAt,
      entrantCounts: Object.fromEntries(
        counts.map((item) => [item.status, item._count._all])
      ),
      economicStake: null,
      serverAuthoritative: true
    };
  }

  private async syncMatchTx(
    tx: Tx,
    tournamentId: string,
    matchId: string,
    actorId: string
  ) {
    const match = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!match || match.tournamentId !== tournamentId) throw this.matchNotFound();
    if (['COMPLETED', 'FORFEIT', 'CANCELLED'].includes(match.status)) {
      return {
        advanced: false,
        reviewRequired: false,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }
    if (!match.gameSessionId) {
      return {
        advanced: false,
        reviewRequired: false,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }
    const session = await tx.gameSession.findUnique({ where: { id: match.gameSessionId } });
    if (!session) {
      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'REVIEW_REQUIRED',
          resolutionReason: 'GAME_SESSION_MISSING',
          version: { increment: 1 }
        }
      });
      return {
        advanced: false,
        reviewRequired: true,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }
    if (session.status === 'ACTIVE' && match.status !== 'ACTIVE') {
      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'ACTIVE',
          startedAt: session.startedAt ?? new Date(),
          version: { increment: 1 }
        }
      });
      return {
        advanced: false,
        reviewRequired: false,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }
    if (session.status === 'WAITING') {
      return {
        advanced: false,
        reviewRequired: false,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }
    if (!['COMPLETED', 'ABANDONED'].includes(session.status) || !session.winnerUserId) {
      await tx.tournamentMatch.updateMany({
        where: { id: match.id, status: { in: ['PENDING', 'WAITING', 'ACTIVE'] } },
        data: {
          status: 'REVIEW_REQUIRED',
          resolutionReason: `GAME_${session.status}`,
          version: { increment: 1 }
        }
      });
      await tx.tournamentEvent.create({
        data: {
          tournamentId,
          actorId,
          action: 'MATCH_REVIEW_REQUIRED',
          subjectId: match.id,
          metadata: this.json({ gameSessionId: session.id, gameStatus: session.status })
        }
      });
      return {
        advanced: false,
        reviewRequired: true,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }

    const entrants = await tx.tournamentEntrant.findMany({
      where: {
        id: { in: [match.firstEntrantId ?? '', match.secondEntrantId ?? ''] }
      }
    });
    const winner = entrants.find((entrant) => entrant.captainId === session.winnerUserId);
    if (!winner) {
      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'REVIEW_REQUIRED',
          resolutionReason: 'WINNER_NOT_IN_MATCH',
          version: { increment: 1 }
        }
      });
      return {
        advanced: false,
        reviewRequired: true,
        tournamentCompleted: false,
        winnerUserIds: [] as string[]
      };
    }

    const advanced = await this.advanceWinnerTx(
      tx,
      match as MatchRecord,
      winner.id,
      actorId,
      `GAME_SESSION:${session.id}`,
      'COMPLETED'
    );
    const winnerMembers = await tx.tournamentEntrantMember.findMany({
      where: { entrantId: winner.id, status: 'JOINED' },
      select: { userId: true }
    });
    return {
      advanced: true,
      reviewRequired: false,
      tournamentCompleted: advanced.tournamentCompleted,
      winnerUserIds: winnerMembers.map((item) => item.userId)
    };
  }

  private async advanceWinnerTx(
    tx: Tx,
    match: MatchRecord,
    winnerEntrantId: string,
    actorId: string,
    reason: string,
    terminalStatus: 'COMPLETED' | 'FORFEIT'
  ) {
    if (![match.firstEntrantId, match.secondEntrantId].includes(winnerEntrantId)) {
      throw new BadRequestException({
        code: 'TOURNAMENT_WINNER_INVALID',
        message: 'Le gagnant ne participe pas à ce match.'
      });
    }
    if (['COMPLETED', 'FORFEIT'].includes(match.status)) {
      return { tournamentCompleted: false, nextMatchCreated: false };
    }

    const loserEntrantId =
      match.firstEntrantId === winnerEntrantId
        ? match.secondEntrantId
        : match.firstEntrantId;
    const changed = await tx.tournamentMatch.updateMany({
      where: {
        id: match.id,
        version: match.version,
        status: { in: ACTIVE_MATCH_STATUSES as never[] }
      },
      data: {
        status: terminalStatus,
        winnerEntrantId,
        completedAt: new Date(),
        resolutionReason: reason,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw this.conflict();
    if (loserEntrantId) {
      await tx.tournamentEntrant.updateMany({
        where: {
          id: loserEntrantId,
          status: { in: ['PENDING', 'READY'] }
        },
        data: { status: 'ELIMINATED', eliminatedAt: new Date() }
      });
    }

    if (!match.nextMatchId || !match.nextSlot) {
      await tx.tournamentEntrant.update({
        where: { id: winnerEntrantId },
        data: { status: 'CHAMPION' }
      });
      await tx.tournament.update({
        where: { id: match.tournamentId },
        data: {
          status: 'COMPLETED',
          championEntrantId: winnerEntrantId,
          completedAt: new Date(),
          version: { increment: 1 }
        }
      });
      await tx.tournamentEvent.create({
        data: {
          tournamentId: match.tournamentId,
          actorId,
          action: 'TOURNAMENT_COMPLETED',
          subjectId: winnerEntrantId,
          metadata: this.json({ resultSource: reason, economicStake: false })
        }
      });
      return { tournamentCompleted: true, nextMatchCreated: false };
    }

    const next = await tx.tournamentMatch.update({
      where: { id: match.nextMatchId },
      data:
        match.nextSlot === 'FIRST'
          ? { firstEntrantId: winnerEntrantId, version: { increment: 1 } }
          : { secondEntrantId: winnerEntrantId, version: { increment: 1 } }
    });
    let nextMatchCreated = false;
    if (
      next.firstEntrantId &&
      next.secondEntrantId &&
      !next.gameSessionId &&
      next.status === 'PENDING'
    ) {
      const [tournament, definition] = await Promise.all([
        tx.tournament.findUniqueOrThrow({ where: { id: match.tournamentId } }),
        tx.tournament
          .findUnique({
            where: { id: match.tournamentId },
            select: { gameDefinitionId: true }
          })
          .then((item) =>
            item
              ? tx.gameDefinition.findUnique({ where: { id: item.gameDefinitionId } })
              : null
          )
      ]);
      if (!definition) throw this.gameUnavailable();
      await this.createMatchSessionTx(
        tx,
        tournament,
        definition,
        next.id,
        next.firstEntrantId,
        next.secondEntrantId
      );
      nextMatchCreated = true;
    }
    await tx.tournamentEvent.create({
      data: {
        tournamentId: match.tournamentId,
        actorId,
        action: 'ENTRANT_ADVANCED',
        subjectId: winnerEntrantId,
        metadata: this.json({ fromMatchId: match.id, nextMatchId: match.nextMatchId })
      }
    });
    return { tournamentCompleted: false, nextMatchCreated };
  }

  private async createMatchSessionTx(
    tx: Tx,
    tournament: TournamentRecord,
    definition: {
      id: string;
      key: string;
      version: number;
      engineKey: string;
      minPlayers: number;
      maxPlayers: number;
    },
    matchId: string,
    firstEntrantId: string,
    secondEntrantId: string
  ) {
    const entrants = await tx.tournamentEntrant.findMany({
      where: { id: { in: [firstEntrantId, secondEntrantId] } }
    });
    const first = entrants.find((entrant) => entrant.id === firstEntrantId);
    const second = entrants.find((entrant) => entrant.id === secondEntrantId);
    if (!first || !second) throw this.conflict();
    const captains = await tx.user.findMany({
      where: {
        id: { in: [first.captainId, second.captainId] },
        isSuspended: false
      },
      select: { id: true }
    });
    if (captains.length !== 2) {
      throw new ConflictException({
        code: 'TOURNAMENT_CAPTAIN_UNAVAILABLE',
        message: 'Un capitaine est indisponible. La modération doit examiner le bracket.'
      });
    }

    const engine = this.registry.engine(definition.engineKey);
    const initialState = engine.createInitialState(2);
    const stateHash = sha256Json(initialState);
    const session = await tx.gameSession.create({
      data: {
        definitionId: definition.id,
        definitionKey: definition.key,
        definitionVersion: definition.version,
        ownerId: first.captainId,
        creationKey: `tournament:${tournament.id}:match:${matchId}`,
        seed: randomBytes(32).toString('hex'),
        initialState: this.json(initialState),
        state: this.json(initialState),
        stateHash,
        currentTurnPosition: 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000)
      }
    });
    await tx.gameParticipant.createMany({
      data: [
        {
          sessionId: session.id,
          userId: first.captainId,
          position: 0,
          status: 'JOINED',
          joinedAt: new Date(),
          lastSeenAt: new Date()
        },
        {
          sessionId: session.id,
          userId: second.captainId,
          position: 1,
          status: 'INVITED'
        }
      ]
    });
    await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        gameSessionId: session.id,
        status: 'WAITING',
        version: { increment: 1 }
      }
    });
    return session.id;
  }

  private async forfeitEntrantTx(
    tx: Tx,
    tournamentId: string,
    entrantId: string,
    actorId: string,
    reason: string
  ) {
    const match = await tx.tournamentMatch.findFirst({
      where: {
        tournamentId,
        status: { in: ACTIVE_MATCH_STATUSES as never[] },
        OR: [{ firstEntrantId: entrantId }, { secondEntrantId: entrantId }]
      },
      orderBy: [{ round: 'asc' }, { position: 'asc' }]
    });
    await tx.tournamentEntrant.updateMany({
      where: { id: entrantId, status: { in: ['PENDING', 'READY'] } },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() }
    });
    await tx.tournamentEntrantMember.updateMany({
      where: { entrantId, status: { not: 'LEFT' } },
      data: { status: 'LEFT', leftAt: new Date() }
    });
    if (!match) return false;
    const opponentId =
      match.firstEntrantId === entrantId
        ? match.secondEntrantId
        : match.firstEntrantId;
    if (!opponentId) {
      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'REVIEW_REQUIRED',
          resolutionReason: `FORFEIT_WITHOUT_OPPONENT:${reason}`,
          version: { increment: 1 }
        }
      });
      return false;
    }
    if (match.gameSessionId) {
      await this.cancelGameSessionTx(
        tx,
        match.gameSessionId,
        actorId,
        `TOURNAMENT_FORFEIT:${reason}`
      );
    }
    await this.advanceWinnerTx(
      tx,
      match as MatchRecord,
      opponentId,
      actorId,
      `FORFEIT:${reason}`,
      'FORFEIT'
    );
    return true;
  }

  private async cancelTournamentTx(
    tx: Tx,
    tournamentId: string,
    actorId: string,
    reason: string
  ) {
    const matches = await tx.tournamentMatch.findMany({
      where: {
        tournamentId,
        status: { in: ['PENDING', 'WAITING', 'ACTIVE', 'REVIEW_REQUIRED'] }
      }
    });
    for (const match of matches) {
      if (match.gameSessionId) {
        await this.cancelGameSessionTx(
          tx,
          match.gameSessionId,
          actorId,
          `TOURNAMENT_CANCELLED:${reason}`
        );
      }
    }
    await tx.tournamentMatch.updateMany({
      where: {
        tournamentId,
        status: { in: ['PENDING', 'WAITING', 'ACTIVE', 'REVIEW_REQUIRED'] }
      },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        resolutionReason: reason,
        version: { increment: 1 }
      }
    });
    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        version: { increment: 1 }
      }
    });
    await tx.tournamentEvent.create({
      data: {
        tournamentId,
        actorId,
        action: 'TOURNAMENT_CANCELLED',
        metadata: this.json({ reason })
      }
    });
  }

  private async cancelGameSessionTx(
    tx: Tx,
    sessionId: string,
    actorId: string,
    reason: string
  ) {
    const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
    if (!session || ['COMPLETED', 'ABANDONED', 'CANCELLED', 'EXPIRED'].includes(session.status)) {
      return;
    }
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        currentTurnPosition: null,
        result: this.json({ outcome: 'CANCELLED', reason }),
        cancelledAt: new Date(),
        cancellationReason: reason,
        version: { increment: 1 }
      }
    });
    await tx.gameParticipant.updateMany({
      where: { sessionId, status: { in: ['INVITED', 'JOINED'] } },
      data: { status: 'LEFT', leftAt: new Date() }
    });
    await tx.gameGovernanceEvent.create({
      data: {
        sessionId,
        actorId,
        action: 'CANCEL',
        reason
      }
    });
  }

  private async assertViewer(userId: string, tournamentId: string) {
    const [tournament, member] = await Promise.all([
      this.prisma.tournament.findUnique({ where: { id: tournamentId } }),
      this.prisma.tournamentEntrantMember.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } }
      })
    ]);
    if (!tournament) throw this.notFound();
    if (tournament.ownerId !== userId && !member) {
      throw new ForbiddenException({
        code: 'TOURNAMENT_PARTICIPANT_REQUIRED',
        message: 'Seuls l’organisateur et les participants peuvent synchroniser un match.'
      });
    }
  }

  private assertOwner(
    tournament: { ownerId: string; status: string; registrationClosesAt: Date } | null,
    userId: string
  ): asserts tournament is { ownerId: string; status: string; registrationClosesAt: Date } {
    if (!tournament) throw this.notFound();
    if (tournament.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'TOURNAMENT_OWNER_REQUIRED',
        message: 'Seul l’organisateur peut effectuer cette action.'
      });
    }
  }

  private assertPowerOfTwo(value: number) {
    if (!this.isPowerOfTwo(value)) {
      throw new BadRequestException({
        code: 'TOURNAMENT_CAPACITY_INVALID',
        message: 'La capacité doit être 2, 4, 8, 16 ou 32.'
      });
    }
  }

  private isPowerOfTwo(value: number) {
    return value >= 2 && value <= 32 && (value & (value - 1)) === 0;
  }

  private seedKey(seed: string, entrantId: string) {
    return createHash('sha256').update(`${seed}:${entrantId}`).digest('hex');
  }

  private async assertRateLimit(userId: string) {
    const count = await this.prisma.tournamentEvent.count({
      where: {
        actorId: userId,
        action: { in: ['TOURNAMENT_CREATED', 'ENTRANT_REGISTERED', 'ENTRANT_WITHDREW'] },
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1_000) }
      }
    });
    if (count >= MAX_ACTIONS_PER_DAY) {
      throw new TooManyRequestsException({
        code: 'TOURNAMENT_RATE_LIMITED',
        message: 'Trop d’actions de tournoi ont été effectuées récemment.'
      });
    }
  }

  private receipt(userId: string, idempotencyKey: string) {
    return this.prisma.tournamentReceipt.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } }
    });
  }

  private async writeReceipt(
    tx: Tx,
    userId: string,
    idempotencyKey: string,
    operation: string,
    tournamentId: string
  ) {
    await tx.tournamentReceipt.create({
      data: {
        userId,
        idempotencyKey,
        operation,
        response: this.json({ tournamentId })
      }
    });
  }

  private receiptTournamentId(response: unknown) {
    if (
      response &&
      typeof response === 'object' &&
      !Array.isArray(response) &&
      typeof (response as Record<string, unknown>).tournamentId === 'string'
    ) {
      return (response as Record<string, string>).tournamentId;
    }
    throw this.conflict();
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
    throw this.conflict();
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private notFound() {
    return new NotFoundException({
      code: 'TOURNAMENT_NOT_FOUND',
      message: 'Tournoi introuvable.'
    });
  }

  private matchNotFound() {
    return new NotFoundException({
      code: 'TOURNAMENT_MATCH_NOT_FOUND',
      message: 'Match de tournoi introuvable.'
    });
  }

  private notMember() {
    return new ForbiddenException({
      code: 'TOURNAMENT_MEMBERSHIP_REQUIRED',
      message: 'Cette inscription ne t’appartient pas.'
    });
  }

  private gameUnavailable() {
    return new NotFoundException({
      code: 'TOURNAMENT_GAME_NOT_AVAILABLE',
      message: 'Ce jeu autoritaire n’est pas disponible pour un tournoi.'
    });
  }

  private accountIneligible() {
    return new ForbiddenException({
      code: 'TOURNAMENT_ACCOUNT_NOT_ELIGIBLE',
      message: 'Ce compte ne peut pas participer à ce tournoi.'
    });
  }

  private conflict() {
    return new ConflictException({
      code: 'TOURNAMENT_CONFLICT',
      message: 'Le tournoi a changé. Recharge son état avant de recommencer.'
    });
  }
}
