import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameSessionDto } from './dto/create-game-session.dto';
import { GovernGameSessionDto } from './dto/govern-game-session.dto';
import { SubmitGameActionDto } from './dto/submit-game-action.dto';
import { GameEngineRegistry } from './game-engine.registry';
import {
  canonicalJson,
  isTerminalGameStatus,
  sha256Json
} from './game-platform.domain';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class GamePlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: GameEngineRegistry,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async catalog() {
    const definitions = await this.registry.listActive();
    return definitions.map((definition) => ({
      key: definition.key,
      version: definition.version,
      name: definition.name,
      description: definition.description,
      minPlayers: definition.minPlayers,
      maxPlayers: definition.maxPlayers,
      rules: definition.rules,
      economicStakeAllowed: false,
      authoritativeServer: true,
      replayAvailable: true
    }));
  }

  async create(userId: string, dto: CreateGameSessionDto) {
    const existing = await this.prisma.gameSession.findUnique({
      where: {
        ownerId_creationKey: { ownerId: userId, creationKey: dto.idempotencyKey }
      }
    });
    if (existing) {
      return { ...(await this.view(userId, existing.id)), replayed: true };
    }

    const definition = await this.registry.latestActive(dto.gameKey);
    if (!definition) {
      throw new NotFoundException({
        code: 'GAME_DEFINITION_NOT_FOUND',
        message: 'Ce jeu n’est pas disponible.'
      });
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        isSuspended: true
      }
    });
    if (!owner || owner.isSuspended) {
      throw new ForbiddenException({
        code: 'GAME_ACCOUNT_NOT_ELIGIBLE',
        message: 'Ce compte ne peut pas créer de partie.'
      });
    }

    const normalizedUsernames = [
      ...new Set(dto.opponentUsernames.map((username) => username.toLowerCase()))
    ];
    if (normalizedUsernames.includes(owner.username.toLowerCase())) {
      throw new BadRequestException({
        code: 'GAME_SELF_INVITATION_FORBIDDEN',
        message: 'Tu ne peux pas t’inviter toi-même.'
      });
    }
    const opponents = await this.prisma.user.findMany({
      where: {
        username: { in: normalizedUsernames, mode: 'insensitive' },
        isSuspended: false
      },
      select: { id: true, username: true, displayName: true }
    });
    if (opponents.length !== normalizedUsernames.length) {
      throw new NotFoundException({
        code: 'GAME_OPPONENT_NOT_FOUND',
        message: 'Au moins un joueur invité est introuvable ou indisponible.'
      });
    }

    const players = [owner, ...opponents];
    if (
      players.length < definition.minPlayers ||
      players.length > definition.maxPlayers
    ) {
      throw new BadRequestException({
        code: 'GAME_PLAYER_COUNT_INVALID',
        message: `Ce jeu accepte entre ${definition.minPlayers} et ${definition.maxPlayers} joueurs.`
      });
    }

    const engine = this.registry.engine(definition.engineKey);
    const initialState = engine.createInitialState(players.length);
    const seed = randomBytes(32).toString('hex');
    const stateHash = sha256Json(initialState);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);

    let sessionId: string;
    try {
      sessionId = await this.prisma.$transaction(
        async (tx) => {
          const replay = await tx.gameSession.findUnique({
            where: {
              ownerId_creationKey: {
                ownerId: userId,
                creationKey: dto.idempotencyKey
              }
            },
            select: { id: true }
          });
          if (replay) return replay.id;

          const session = await tx.gameSession.create({
            data: {
              definitionId: definition.id,
              definitionKey: definition.key,
              definitionVersion: definition.version,
              ownerId: userId,
              creationKey: dto.idempotencyKey,
              seed,
              initialState: this.json(initialState),
              state: this.json(initialState),
              stateHash,
              currentTurnPosition: 0,
              expiresAt
            }
          });
          await tx.gameParticipant.createMany({
            data: players.map((player, position) => ({
              sessionId: session.id,
              userId: player.id,
              position,
              status: position === 0 ? 'JOINED' : 'INVITED',
              joinedAt: position === 0 ? new Date() : null,
              lastSeenAt: position === 0 ? new Date() : null
            }))
          });
          return session.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.gameSession.findUnique({
          where: {
            ownerId_creationKey: {
              ownerId: userId,
              creationKey: dto.idempotencyKey
            }
          },
          select: { id: true }
        });
        if (replay) return { ...(await this.view(userId, replay.id)), replayed: true };
      }
      throw error;
    }

    await Promise.all(
      opponents.map((opponent) =>
        this.notifications.create({
          userId: opponent.id,
          type: 'GAME_INVITATION',
          title: 'Invitation à jouer',
          body: `${owner.displayName} t’invite à jouer à ${definition.name}.`,
          data: {
            route: `/games?session=${sessionId}`,
            entityType: 'GAME_SESSION',
            entityId: sessionId,
            actorId: userId,
            gameKey: definition.key
          }
        })
      )
    );
    await this.audit.record({
      actorId: userId,
      action: 'GAME_SESSION_CREATED',
      entity: 'GameSession',
      entityId: sessionId,
      metadata: {
        gameKey: definition.key,
        definitionVersion: definition.version,
        participantCount: players.length,
        economicStake: false
      }
    });
    return { ...(await this.view(userId, sessionId)), replayed: false };
  }

  async join(userId: string, sessionId: string) {
    await this.expireOneIfDue(sessionId);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
        if (!session) throw this.notFound();
        const participant = await tx.gameParticipant.findUnique({
          where: { sessionId_userId: { sessionId, userId } }
        });
        if (!participant) throw this.notParticipant();
        if (participant.status === 'JOINED') {
          return { activated: session.status === 'ACTIVE', replayed: true };
        }
        if (session.status !== 'WAITING' || participant.status !== 'INVITED') {
          throw new ConflictException({
            code: 'GAME_INVITATION_CLOSED',
            message: 'Cette invitation n’est plus disponible.'
          });
        }
        await tx.gameParticipant.update({
          where: { sessionId_userId: { sessionId, userId } },
          data: { status: 'JOINED', joinedAt: new Date(), lastSeenAt: new Date() }
        });
        const remaining = await tx.gameParticipant.count({
          where: { sessionId, status: { not: 'JOINED' } }
        });
        if (remaining > 0) return { activated: false, replayed: false };
        const activated = await tx.gameSession.updateMany({
          where: { id: sessionId, status: 'WAITING', version: session.version },
          data: {
            status: 'ACTIVE',
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
            version: { increment: 1 }
          }
        });
        if (activated.count !== 1) throw this.staleSession();
        return { activated: true, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (result.activated && !result.replayed) {
      const session = await this.prisma.gameSession.findUniqueOrThrow({
        where: { id: sessionId }
      });
      await this.notifications.create({
        userId: session.ownerId,
        type: 'GAME_STARTED',
        title: 'La partie commence',
        body: 'Tous les joueurs ont rejoint la partie.',
        data: {
          route: `/games?session=${sessionId}`,
          entityType: 'GAME_SESSION',
          entityId: sessionId
        }
      });
    }
    return { ...(await this.view(userId, sessionId)), replayed: result.replayed };
  }

  async listMine(userId: string, status?: string) {
    const memberships = await this.prisma.gameParticipant.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: { sessionId: true }
    });
    if (!memberships.length) return [];
    const allowedStatuses = [
      'WAITING',
      'ACTIVE',
      'COMPLETED',
      'ABANDONED',
      'CANCELLED',
      'EXPIRED'
    ];
    const normalizedStatus = status?.toUpperCase();
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        id: { in: memberships.map((item) => item.sessionId) },
        ...(normalizedStatus && allowedStatuses.includes(normalizedStatus)
          ? { status: normalizedStatus as never }
          : {})
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 50
    });
    return Promise.all(sessions.map((session) => this.summary(userId, session.id)));
  }

  async view(userId: string, sessionId: string) {
    await this.expireOneIfDue(sessionId);
    const [session, participants] = await Promise.all([
      this.prisma.gameSession.findUnique({ where: { id: sessionId } }),
      this.prisma.gameParticipant.findMany({
        where: { sessionId },
        orderBy: { position: 'asc' }
      })
    ]);
    if (!session) throw this.notFound();
    const viewer = participants.find((participant) => participant.userId === userId);
    if (!viewer) throw this.notParticipant();
    const [definition, users] = await Promise.all([
      this.prisma.gameDefinition.findUnique({ where: { id: session.definitionId } }),
      this.prisma.user.findMany({
        where: { id: { in: participants.map((participant) => participant.userId) } },
        select: { id: true, username: true, displayName: true, avatarUrl: true }
      })
    ]);
    if (!definition) throw new Error('Game definition missing.');
    const userMap = new Map(users.map((user) => [user.id, user]));
    const engine = this.registry.engine(definition.engineKey);
    return {
      id: session.id,
      game: {
        key: definition.key,
        version: definition.version,
        name: definition.name,
        description: definition.description,
        rules: definition.rules
      },
      status: session.status,
      sequence: session.sequence,
      state: engine.publicState(session.state),
      stateHash: session.stateHash,
      currentTurnPosition: session.currentTurnPosition,
      winnerUserId: session.winnerUserId,
      result: session.result,
      viewerPosition: viewer.position,
      yourTurn:
        session.status === 'ACTIVE' &&
        session.currentTurnPosition === viewer.position,
      participants: participants.map((participant) => ({
        userId: participant.userId,
        position: participant.position,
        status: participant.status,
        joinedAt: participant.joinedAt,
        lastSeenAt: participant.lastSeenAt,
        user: userMap.get(participant.userId) ?? null
      })),
      expiresAt: session.expiresAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      economicStake: null,
      serverAuthoritative: true
    };
  }

  async reconnect(userId: string, sessionId: string) {
    const participant = await this.prisma.gameParticipant.updateMany({
      where: { sessionId, userId },
      data: { lastSeenAt: new Date() }
    });
    if (!participant.count) throw this.notParticipant();
    return this.view(userId, sessionId);
  }

  async submitAction(
    userId: string,
    sessionId: string,
    dto: SubmitGameActionDto
  ) {
    const payloadBytes = Buffer.byteLength(JSON.stringify(dto.payload), 'utf8');
    if (payloadBytes > 2_048) {
      throw new BadRequestException({
        code: 'GAME_ACTION_PAYLOAD_TOO_LARGE',
        message: 'Cette action dépasse la taille autorisée.'
      });
    }
    await this.expireOneIfDue(sessionId);

    let replayed = false;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const receipt = await tx.gameActionReceipt.findUnique({
            where: {
              sessionId_actorId_idempotencyKey: {
                sessionId,
                actorId: userId,
                idempotencyKey: dto.idempotencyKey
              }
            }
          });
          if (receipt) {
            replayed = true;
            return;
          }

          const [session, participant, definition] = await Promise.all([
            tx.gameSession.findUnique({ where: { id: sessionId } }),
            tx.gameParticipant.findUnique({
              where: { sessionId_userId: { sessionId, userId } }
            }),
            tx.gameSession
              .findUnique({ where: { id: sessionId }, select: { definitionId: true } })
              .then((value) =>
                value
                  ? tx.gameDefinition.findUnique({ where: { id: value.definitionId } })
                  : null
              )
          ]);
          if (!session || !definition) throw this.notFound();
          if (!participant || participant.status !== 'JOINED') {
            throw this.notParticipant();
          }
          if (session.status !== 'ACTIVE') {
            throw new ConflictException({
              code: 'GAME_SESSION_NOT_ACTIVE',
              message: 'Cette partie n’est pas active.'
            });
          }
          if (session.sequence !== dto.expectedSequence) throw this.staleSession();
          if (sha256Json(session.state) !== session.stateHash) {
            throw new ConflictException({
              code: 'GAME_STATE_INTEGRITY_FAILURE',
              message: 'L’état de cette partie doit être vérifié par le serveur.'
            });
          }

          const engine = this.registry.engine(definition.engineKey);
          const applied = engine.apply({
            state: session.state,
            actorPosition: participant.position,
            actionType: dto.actionType,
            payload: dto.payload,
            seed: session.seed
          });
          const nextSequence = session.sequence + 1;
          const nextStateHash = sha256Json(applied.state);
          let winnerUserId: string | null = null;
          if (applied.winnerPosition !== null) {
            const winner = await tx.gameParticipant.findUnique({
              where: {
                sessionId_position: {
                  sessionId,
                  position: applied.winnerPosition
                }
              }
            });
            winnerUserId = winner?.userId ?? null;
          }

          const changed = await tx.gameSession.updateMany({
            where: {
              id: sessionId,
              status: 'ACTIVE',
              sequence: dto.expectedSequence,
              version: session.version
            },
            data: {
              state: this.json(applied.state),
              stateHash: nextStateHash,
              sequence: nextSequence,
              currentTurnPosition: applied.currentTurnPosition,
              winnerUserId,
              result: applied.result ? this.json(applied.result) : Prisma.JsonNull,
              status: applied.completed ? 'COMPLETED' : 'ACTIVE',
              completedAt: applied.completed ? new Date() : null,
              version: { increment: 1 }
            }
          });
          if (changed.count !== 1) throw this.staleSession();

          await tx.gameAction.create({
            data: {
              sessionId,
              actorId: userId,
              sequence: nextSequence,
              idempotencyKey: dto.idempotencyKey,
              actionType: dto.actionType,
              payload: this.json(dto.payload),
              stateHashBefore: session.stateHash,
              stateHashAfter: nextStateHash
            }
          });
          await tx.gameActionReceipt.create({
            data: {
              sessionId,
              actorId: userId,
              idempotencyKey: dto.idempotencyKey,
              sequence: nextSequence,
              response: this.json({ accepted: true, sequence: nextSequence })
            }
          });
          await tx.gameParticipant.update({
            where: { sessionId_userId: { sessionId, userId } },
            data: {
              lastSeenAt: new Date(),
              ...(applied.completed ? { status: 'COMPLETED' } : {})
            }
          });

          if (applied.completed && applied.result) {
            await tx.gameParticipant.updateMany({
              where: { sessionId, status: 'JOINED' },
              data: { status: 'COMPLETED' }
            });
            await this.createReplaySnapshot(tx, {
              sessionId,
              definitionKey: session.definitionKey,
              definitionVersion: session.definitionVersion,
              seed: session.seed,
              initialState: session.initialState,
              finalState: applied.state,
              result: applied.result,
              actionCount: nextSequence
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        const receipt = await this.prisma.gameActionReceipt.findUnique({
          where: {
            sessionId_actorId_idempotencyKey: {
              sessionId,
              actorId: userId,
              idempotencyKey: dto.idempotencyKey
            }
          }
        });
        if (receipt) replayed = true;
        else throw this.staleSession();
      } else {
        throw error;
      }
    }

    const view = await this.view(userId, sessionId);
    if (!replayed) await this.notifyTurnOrResult(view);
    return { ...view, replayed };
  }

  async abandon(userId: string, sessionId: string) {
    await this.expireOneIfDue(sessionId);
    let changed = false;
    await this.prisma.$transaction(
      async (tx) => {
        const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
        if (!session) throw this.notFound();
        const participant = await tx.gameParticipant.findUnique({
          where: { sessionId_userId: { sessionId, userId } }
        });
        if (!participant) throw this.notParticipant();
        if (isTerminalGameStatus(session.status)) return;
        if (session.status === 'WAITING') {
          if (session.ownerId === userId) {
            await this.cancelSession(tx, sessionId, userId, 'OWNER_CANCELLED');
          } else {
            await tx.gameParticipant.update({
              where: { sessionId_userId: { sessionId, userId } },
              data: { status: 'LEFT', leftAt: new Date() }
            });
            await this.cancelSession(tx, sessionId, userId, 'INVITEE_LEFT');
          }
          changed = true;
          return;
        }
        const other = await tx.gameParticipant.findFirst({
          where: { sessionId, userId: { not: userId }, status: 'JOINED' },
          orderBy: { position: 'asc' }
        });
        const result = {
          outcome: 'ABANDON',
          abandonedPosition: participant.position,
          winnerPosition: other?.position ?? null
        };
        const update = await tx.gameSession.updateMany({
          where: { id: sessionId, status: 'ACTIVE', version: session.version },
          data: {
            status: 'ABANDONED',
            winnerUserId: other?.userId ?? null,
            result: this.json(result),
            currentTurnPosition: null,
            completedAt: new Date(),
            version: { increment: 1 }
          }
        });
        if (update.count !== 1) throw this.staleSession();
        await tx.gameParticipant.update({
          where: { sessionId_userId: { sessionId, userId } },
          data: { status: 'ABANDONED', leftAt: new Date() }
        });
        await tx.gameParticipant.updateMany({
          where: { sessionId, userId: { not: userId }, status: 'JOINED' },
          data: { status: 'COMPLETED' }
        });
        await this.createReplaySnapshot(tx, {
          sessionId,
          definitionKey: session.definitionKey,
          definitionVersion: session.definitionVersion,
          seed: session.seed,
          initialState: session.initialState,
          finalState: session.state,
          result,
          actionCount: session.sequence
        });
        changed = true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (changed) {
      await this.audit.record({
        actorId: userId,
        action: 'GAME_SESSION_ABANDONED',
        entity: 'GameSession',
        entityId: sessionId
      });
    }
    return { ...(await this.view(userId, sessionId)), replayed: !changed };
  }

  async cancel(userId: string, sessionId: string) {
    let changed = false;
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
      if (!session) throw this.notFound();
      if (session.ownerId !== userId) {
        throw new ForbiddenException({
          code: 'GAME_OWNER_REQUIRED',
          message: 'Seul le créateur de la partie peut l’annuler.'
        });
      }
      if (isTerminalGameStatus(session.status)) return;
      if (session.status !== 'WAITING') {
        throw new ConflictException({
          code: 'GAME_CANCEL_WINDOW_CLOSED',
          message: 'Une partie commencée doit être abandonnée, pas annulée.'
        });
      }
      await this.cancelSession(tx, sessionId, userId, 'OWNER_CANCELLED');
      changed = true;
    });
    return { ...(await this.view(userId, sessionId)), replayed: !changed };
  }

  async replay(userId: string, sessionId: string) {
    const participant = await this.prisma.gameParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } }
    });
    if (!participant) throw this.notParticipant();
    const [session, snapshot, actions, participants] = await Promise.all([
      this.prisma.gameSession.findUnique({ where: { id: sessionId } }),
      this.prisma.gameReplaySnapshot.findUnique({ where: { sessionId } }),
      this.prisma.gameAction.findMany({
        where: { sessionId },
        orderBy: { sequence: 'asc' }
      }),
      this.prisma.gameParticipant.findMany({
        where: { sessionId },
        orderBy: { position: 'asc' }
      })
    ]);
    if (!session || !snapshot || !isTerminalGameStatus(session.status)) {
      throw new ConflictException({
        code: 'GAME_REPLAY_NOT_READY',
        message: 'Le replay sera disponible à la fin de la partie.'
      });
    }
    const checksum = sha256Json({
      definitionKey: snapshot.definitionKey,
      definitionVersion: snapshot.definitionVersion,
      seed: snapshot.seed,
      initialState: snapshot.initialState,
      finalState: snapshot.finalState,
      result: snapshot.result,
      actionCount: snapshot.actionCount
    });
    return {
      sessionId,
      definitionKey: snapshot.definitionKey,
      definitionVersion: snapshot.definitionVersion,
      seed: snapshot.seed,
      initialState: snapshot.initialState,
      finalState: snapshot.finalState,
      result: snapshot.result,
      participants: participants.map((item) => ({
        userId: item.userId,
        position: item.position
      })),
      actions: actions.map((action) => ({
        sequence: action.sequence,
        actorId: action.actorId,
        actionType: action.actionType,
        payload: action.payload,
        stateHashBefore: action.stateHashBefore,
        stateHashAfter: action.stateHashAfter,
        createdAt: action.createdAt
      })),
      checksum: snapshot.checksum,
      verified: checksum === snapshot.checksum,
      reproducible: true,
      economicStake: null
    };
  }

  async govern(
    actorId: string,
    sessionId: string,
    dto: GovernGameSessionDto
  ) {
    let changed = false;
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
      if (!session) throw this.notFound();
      if (!isTerminalGameStatus(session.status)) {
        await this.cancelSession(tx, sessionId, actorId, `ADMIN:${dto.reason.trim()}`);
        changed = true;
      }
      await tx.gameGovernanceEvent.create({
        data: {
          sessionId,
          actorId,
          action: dto.action,
          reason: dto.reason.trim(),
          metadata: this.json({ changed, previousStatus: session.status })
        }
      });
    });
    await this.audit.record({
      actorId,
      action: 'GAME_SESSION_GOVERNED',
      entity: 'GameSession',
      entityId: sessionId,
      metadata: { action: dto.action, reason: dto.reason.trim(), changed }
    });
    return { sessionId, changed };
  }

  async operations(status?: string) {
    const allowed = [
      'WAITING',
      'ACTIVE',
      'COMPLETED',
      'ABANDONED',
      'CANCELLED',
      'EXPIRED'
    ];
    const normalized = status?.toUpperCase();
    const [sessions, counts] = await Promise.all([
      this.prisma.gameSession.findMany({
        where:
          normalized && allowed.includes(normalized)
            ? { status: normalized as never }
            : undefined,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: {
          id: true,
          definitionKey: true,
          definitionVersion: true,
          ownerId: true,
          status: true,
          sequence: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          cancellationReason: true
        }
      }),
      this.prisma.gameSession.groupBy({ by: ['status'], _count: { _all: true } })
    ]);
    return {
      sessions,
      counts: Object.fromEntries(
        counts.map((item) => [item.status, item._count._all])
      ),
      economicStakeEnabled: false
    };
  }

  async expireDue(limit = 100) {
    const due = await this.prisma.gameSession.findMany({
      where: {
        status: { in: ['WAITING', 'ACTIVE'] },
        expiresAt: { lt: new Date() }
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: Math.min(500, Math.max(1, limit)),
      select: { id: true }
    });
    let expired = 0;
    for (const item of due) {
      if (await this.expireOneIfDue(item.id)) expired += 1;
    }
    return { inspected: due.length, expired };
  }

  async exportForAccount(userId: string) {
    const memberships = await this.prisma.gameParticipant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    const sessionIds = memberships.map((membership) => membership.sessionId);
    const [sessions, actions] = await Promise.all([
      sessionIds.length
        ? this.prisma.gameSession.findMany({
            where: { id: { in: sessionIds } },
            orderBy: { createdAt: 'desc' }
          })
        : [],
      this.prisma.gameAction.findMany({
        where: { actorId: userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
    ]);
    return {
      formatVersion: 1,
      economicStakeIncluded: false,
      activeSeedsIncluded: false,
      memberships,
      sessions: sessions.map((session) => ({
        id: session.id,
        definitionKey: session.definitionKey,
        definitionVersion: session.definitionVersion,
        status: session.status,
        sequence: session.sequence,
        result: session.result,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      })),
      authoredActions: actions.map((action) => ({
        sessionId: action.sessionId,
        sequence: action.sequence,
        actionType: action.actionType,
        payload: action.payload,
        createdAt: action.createdAt
      }))
    };
  }

  async deleteForAccount(userId: string, tx: TransactionClient) {
    const memberships = await tx.gameParticipant.findMany({
      where: { userId },
      select: { sessionId: true }
    });
    const sessionIds = [...new Set(memberships.map((item) => item.sessionId))];
    if (!sessionIds.length) return;
    const tombstone = `deleted-${randomUUID()}`;

    await tx.gameActionReceipt.deleteMany({ where: { actorId: userId } });
    await tx.gameAction.updateMany({
      where: { actorId: userId },
      data: { actorId: tombstone }
    });
    await tx.gameGovernanceEvent.updateMany({
      where: { actorId: userId },
      data: { actorId: tombstone }
    });
    await tx.gameSession.updateMany({
      where: { id: { in: sessionIds }, status: { in: ['WAITING', 'ACTIVE'] } },
      data: {
        status: 'CANCELLED',
        currentTurnPosition: null,
        cancelledAt: new Date(),
        cancellationReason: 'ACCOUNT_DELETED',
        version: { increment: 1 }
      }
    });
    await tx.gameSession.updateMany({
      where: { ownerId: userId },
      data: { ownerId: tombstone }
    });
    await tx.gameSession.updateMany({
      where: { winnerUserId: userId },
      data: { winnerUserId: null }
    });
    await tx.gameParticipant.deleteMany({ where: { userId } });

    const remaining = await tx.gameParticipant.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true }
    });
    const remainingIds = new Set(remaining.map((item) => item.sessionId));
    const emptySessionIds = sessionIds.filter((id) => !remainingIds.has(id));
    if (emptySessionIds.length) {
      await tx.gameActionReceipt.deleteMany({
        where: { sessionId: { in: emptySessionIds } }
      });
      await tx.gameAction.deleteMany({ where: { sessionId: { in: emptySessionIds } } });
      await tx.gameReplaySnapshot.deleteMany({
        where: { sessionId: { in: emptySessionIds } }
      });
      await tx.gameGovernanceEvent.deleteMany({
        where: { sessionId: { in: emptySessionIds } }
      });
      await tx.gameSession.deleteMany({ where: { id: { in: emptySessionIds } } });
    }
  }

  private async summary(userId: string, sessionId: string) {
    const view = await this.view(userId, sessionId);
    return {
      id: view.id,
      game: view.game,
      status: view.status,
      sequence: view.sequence,
      yourTurn: view.yourTurn,
      participants: view.participants,
      result: view.result,
      updatedAt: view.updatedAt,
      expiresAt: view.expiresAt
    };
  }

  private async notifyTurnOrResult(view: Awaited<ReturnType<GamePlatformService['view']>>) {
    if (view.status === 'COMPLETED') {
      await Promise.all(
        view.participants.map((participant) =>
          this.notifications.create({
            userId: participant.userId,
            type: 'GAME_COMPLETED',
            title: 'Partie terminée',
            body: `La partie ${view.game.name} est terminée.`,
            data: {
              route: `/games?session=${view.id}`,
              entityType: 'GAME_SESSION',
              entityId: view.id
            }
          })
        )
      );
      return;
    }
    if (view.currentTurnPosition === null) return;
    const next = view.participants.find(
      (participant) => participant.position === view.currentTurnPosition
    );
    if (!next) return;
    await this.notifications.create({
      userId: next.userId,
      type: 'GAME_YOUR_TURN',
      title: 'À toi de jouer',
      body: `C’est ton tour dans ${view.game.name}.`,
      data: {
        route: `/games?session=${view.id}`,
        entityType: 'GAME_SESSION',
        entityId: view.id
      }
    });
  }

  private async expireOneIfDue(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (
      !session ||
      !['WAITING', 'ACTIVE'].includes(session.status) ||
      session.expiresAt.getTime() >= Date.now()
    ) {
      return false;
    }
    const changed = await this.prisma.gameSession.updateMany({
      where: {
        id: sessionId,
        status: session.status,
        version: session.version,
        expiresAt: { lt: new Date() }
      },
      data: {
        status: 'EXPIRED',
        currentTurnPosition: null,
        cancelledAt: new Date(),
        cancellationReason: 'TIMEOUT',
        version: { increment: 1 }
      }
    });
    if (!changed.count) return false;
    await this.prisma.gameParticipant.updateMany({
      where: { sessionId, status: { in: ['INVITED', 'JOINED'] } },
      data: { status: 'LEFT', leftAt: new Date() }
    });
    await this.prisma.gameReplaySnapshot.upsert({
      where: { sessionId },
      create: {
        sessionId,
        definitionKey: session.definitionKey,
        definitionVersion: session.definitionVersion,
        seed: session.seed,
        initialState: session.initialState,
        finalState: session.state,
        result: this.json({ outcome: 'EXPIRED' }),
        actionCount: session.sequence,
        checksum: sha256Json({
          definitionKey: session.definitionKey,
          definitionVersion: session.definitionVersion,
          seed: session.seed,
          initialState: session.initialState,
          finalState: session.state,
          result: { outcome: 'EXPIRED' },
          actionCount: session.sequence
        })
      },
      update: {}
    });
    return true;
  }

  private async cancelSession(
    tx: TransactionClient,
    sessionId: string,
    actorId: string,
    reason: string
  ) {
    const session = await tx.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    const result = { outcome: 'CANCELLED', reason };
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        currentTurnPosition: null,
        result: this.json(result),
        cancelledAt: new Date(),
        cancellationReason: reason,
        version: { increment: 1 }
      }
    });
    await tx.gameParticipant.updateMany({
      where: { sessionId, status: { in: ['INVITED', 'JOINED'] } },
      data: { status: 'LEFT', leftAt: new Date() }
    });
    await this.createReplaySnapshot(tx, {
      sessionId,
      definitionKey: session.definitionKey,
      definitionVersion: session.definitionVersion,
      seed: session.seed,
      initialState: session.initialState,
      finalState: session.state,
      result,
      actionCount: session.sequence
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

  private async createReplaySnapshot(
    tx: TransactionClient,
    input: {
      sessionId: string;
      definitionKey: string;
      definitionVersion: number;
      seed: string;
      initialState: unknown;
      finalState: unknown;
      result: unknown;
      actionCount: number;
    }
  ) {
    const checksumInput = {
      definitionKey: input.definitionKey,
      definitionVersion: input.definitionVersion,
      seed: input.seed,
      initialState: input.initialState,
      finalState: input.finalState,
      result: input.result,
      actionCount: input.actionCount
    };
    await tx.gameReplaySnapshot.upsert({
      where: { sessionId: input.sessionId },
      create: {
        sessionId: input.sessionId,
        definitionKey: input.definitionKey,
        definitionVersion: input.definitionVersion,
        seed: input.seed,
        initialState: this.json(input.initialState),
        finalState: this.json(input.finalState),
        result: this.json(input.result),
        actionCount: input.actionCount,
        checksum: sha256Json(checksumInput)
      },
      update: {}
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(canonicalJson(value)) as Prisma.InputJsonValue;
  }

  private notFound() {
    return new NotFoundException({
      code: 'GAME_SESSION_NOT_FOUND',
      message: 'Partie introuvable.'
    });
  }

  private notParticipant() {
    return new ForbiddenException({
      code: 'GAME_PARTICIPANT_REQUIRED',
      message: 'Cette partie ne t’appartient pas.'
    });
  }

  private staleSession() {
    return new ConflictException({
      code: 'GAME_SEQUENCE_CONFLICT',
      message: 'La partie a changé. Recharge son état avant de rejouer.'
    });
  }
}
