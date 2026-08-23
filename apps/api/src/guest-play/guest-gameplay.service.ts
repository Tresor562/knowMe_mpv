import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { SubmitGameActionDto } from '../games/dto/submit-game-action.dto';
import { GameEngineRegistry } from '../games/game-engine.registry';
import { sha256Json } from '../games/game-platform.domain';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestGameSessionDto } from './guest-game.dto';
import {
  canPersistGuestGameplay,
  guestGameSessionExpiry
} from './guest-game-session.policy';
import { GuestPlayService } from './guest-play.service';

const GUEST_GAME_ALLOWLIST = new Map<string, string>([
  ['quick-math', 'QUICK_MATH_V1']
]);

@Injectable()
export class GuestGameplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: GameEngineRegistry,
    private readonly guests: GuestPlayService
  ) {}

  async createFromAuthorization(
    authorization: string | undefined,
    gameKey: string,
    dto: CreateGuestGameSessionDto
  ) {
    const key = this.normalizeGameKey(gameKey);
    const expectedEngine = GUEST_GAME_ALLOWLIST.get(key);
    if (!expectedEngine) throw this.gameUnavailable();

    const guest = await this.guests.gameplayIdentityFromAuthorization(authorization);
    const existing = await this.prisma.guestGameSession.findUnique({
      where: {
        guestId_creationKey: {
          guestId: guest.id,
          creationKey: dto.idempotencyKey
        }
      }
    });
    if (existing) {
      if (existing.definitionKey !== key) {
        throw new ConflictException({
          code: 'GUEST_GAME_CREATION_KEY_REUSED',
          message: 'Cette clé de création est déjà utilisée pour une autre partie.'
        });
      }
      return { ...(await this.viewForGuest(guest.id, existing.id)), replayed: true };
    }

    const definition = await this.registry.latestActive(key);
    if (
      !definition ||
      definition.engineKey !== expectedEngine ||
      definition.minPlayers !== 1 ||
      definition.maxPlayers !== 1
    ) {
      throw this.gameUnavailable();
    }

    const engine = this.registry.engine(definition.engineKey);
    const initialState = engine.createInitialState(1);
    const seed = randomBytes(32).toString('hex');
    const stateHash = sha256Json(initialState);

    let sessionId: string;
    try {
      sessionId = await this.prisma.$transaction(
        async (tx) => {
          const currentGuest = await tx.guestIdentity.findUnique({
            where: { id: guest.id },
            select: {
              id: true,
              status: true,
              expiresAt: true,
              convertedUserId: true
            }
          });
          if (!currentGuest || !canPersistGuestGameplay(currentGuest, new Date())) {
            throw this.guestUnavailable();
          }

          const replay = await tx.guestGameSession.findUnique({
            where: {
              guestId_creationKey: {
                guestId: guest.id,
                creationKey: dto.idempotencyKey
              }
            }
          });
          if (replay) {
            if (replay.definitionKey !== key) {
              throw new ConflictException({
                code: 'GUEST_GAME_CREATION_KEY_REUSED',
                message: 'Cette clé de création est déjà utilisée pour une autre partie.'
              });
            }
            return replay.id;
          }

          const session = await tx.guestGameSession.create({
            data: {
              guestId: guest.id,
              definitionKey: definition.key,
              definitionVersion: definition.version,
              creationKey: dto.idempotencyKey,
              seed,
              initialState: this.json(initialState),
              state: this.json(initialState),
              stateHash,
              sequence: 0,
              currentTurnPosition: 0,
              expiresAt: guestGameSessionExpiry(currentGuest.expiresAt, new Date())
            }
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
        const replay = await this.prisma.guestGameSession.findUnique({
          where: {
            guestId_creationKey: {
              guestId: guest.id,
              creationKey: dto.idempotencyKey
            }
          }
        });
        if (replay && replay.definitionKey === key) {
          return { ...(await this.viewForGuest(guest.id, replay.id)), replayed: true };
        }
      }
      throw error;
    }

    return { ...(await this.viewForGuest(guest.id, sessionId)), replayed: false };
  }

  async viewFromAuthorization(authorization: string | undefined, sessionId: string) {
    const guest = await this.guests.gameplayIdentityFromAuthorization(authorization);
    await this.expireIfDue(sessionId);
    return this.viewForGuest(guest.id, sessionId);
  }

  async submitActionFromAuthorization(
    authorization: string | undefined,
    sessionId: string,
    dto: SubmitGameActionDto
  ) {
    const guest = await this.guests.gameplayIdentityFromAuthorization(authorization);
    const payloadBytes = Buffer.byteLength(JSON.stringify(dto.payload), 'utf8');
    if (payloadBytes > 2_048) {
      throw new BadRequestException({
        code: 'GAME_ACTION_PAYLOAD_TOO_LARGE',
        message: 'Cette action dépasse la taille autorisée.'
      });
    }

    await this.expireIfDue(sessionId);
    let replayed = false;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const receipt = await tx.guestGameActionReceipt.findUnique({
            where: {
              sessionId_guestId_idempotencyKey: {
                sessionId,
                guestId: guest.id,
                idempotencyKey: dto.idempotencyKey
              }
            }
          });
          if (receipt) {
            replayed = true;
            return;
          }

          const [session, currentGuest] = await Promise.all([
            tx.guestGameSession.findUnique({ where: { id: sessionId } }),
            tx.guestIdentity.findUnique({
              where: { id: guest.id },
              select: {
                id: true,
                status: true,
                expiresAt: true,
                convertedUserId: true
              }
            })
          ]);
          if (!session || session.guestId !== guest.id) throw this.sessionNotFound();
          if (!currentGuest || !canPersistGuestGameplay(currentGuest, new Date())) {
            throw this.guestUnavailable();
          }
          if (session.status !== 'ACTIVE' || session.expiresAt.getTime() <= Date.now()) {
            throw new ConflictException({
              code: 'GUEST_GAME_SESSION_NOT_ACTIVE',
              message: 'Cette partie invitée n’est plus active.'
            });
          }
          if (session.sequence !== dto.expectedSequence) throw this.staleSession();
          if (sha256Json(session.state) !== session.stateHash) {
            throw new ConflictException({
              code: 'GAME_STATE_INTEGRITY_FAILURE',
              message: 'L’état de cette partie doit être vérifié par le serveur.'
            });
          }

          const definition = await tx.gameDefinition.findUnique({
            where: {
              key_version: {
                key: session.definitionKey,
                version: session.definitionVersion
              }
            }
          });
          const expectedEngine = GUEST_GAME_ALLOWLIST.get(session.definitionKey);
          if (!definition || !expectedEngine || definition.engineKey !== expectedEngine) {
            throw this.gameUnavailable();
          }

          const engine = this.registry.engine(definition.engineKey);
          const applied = engine.apply({
            state: session.state,
            actorPosition: 0,
            actionType: dto.actionType,
            payload: dto.payload,
            seed: session.seed
          });
          const nextSequence = session.sequence + 1;
          const nextStateHash = sha256Json(applied.state);

          const changed = await tx.guestGameSession.updateMany({
            where: {
              id: sessionId,
              guestId: guest.id,
              status: 'ACTIVE',
              sequence: dto.expectedSequence
            },
            data: {
              state: this.json(applied.state),
              stateHash: nextStateHash,
              sequence: nextSequence,
              currentTurnPosition: applied.currentTurnPosition,
              result: applied.result ? this.json(applied.result) : Prisma.JsonNull,
              status: applied.completed ? 'COMPLETED' : 'ACTIVE',
              completedAt: applied.completed ? new Date() : null
            }
          });
          if (changed.count !== 1) throw this.staleSession();

          await tx.guestGameAction.create({
            data: {
              sessionId,
              guestId: guest.id,
              sequence: nextSequence,
              idempotencyKey: dto.idempotencyKey,
              actionType: dto.actionType,
              payload: this.json(dto.payload),
              stateHashBefore: session.stateHash,
              stateHashAfter: nextStateHash
            }
          });
          await tx.guestGameActionReceipt.create({
            data: {
              sessionId,
              guestId: guest.id,
              idempotencyKey: dto.idempotencyKey,
              sequence: nextSequence,
              response: this.json({ accepted: true, sequence: nextSequence })
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
        const receipt = await this.prisma.guestGameActionReceipt.findUnique({
          where: {
            sessionId_guestId_idempotencyKey: {
              sessionId,
              guestId: guest.id,
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

    return { ...(await this.viewForGuest(guest.id, sessionId)), replayed };
  }

  private async expireIfDue(sessionId: string) {
    await this.prisma.guestGameSession.updateMany({
      where: {
        id: sessionId,
        status: 'ACTIVE',
        expiresAt: { lte: new Date() }
      },
      data: {
        status: 'EXPIRED',
        currentTurnPosition: null
      }
    });
  }

  private async viewForGuest(guestId: string, sessionId: string) {
    const session = await this.prisma.guestGameSession.findUnique({
      where: { id: sessionId }
    });
    if (!session || session.guestId !== guestId) throw this.sessionNotFound();

    const definition = await this.prisma.gameDefinition.findUnique({
      where: {
        key_version: {
          key: session.definitionKey,
          version: session.definitionVersion
        }
      }
    });
    if (!definition) throw new Error('Guest game definition missing.');
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
      result: session.result,
      expiresAt: session.expiresAt,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      serverAuthoritative: true,
      economicStake: null,
      accountRequired: false
    };
  }

  private normalizeGameKey(gameKey: string) {
    const key = gameKey.trim().toLowerCase();
    return /^[a-z0-9-]{3,60}$/.test(key) ? key : '';
  }

  private gameUnavailable() {
    return new NotFoundException({
      code: 'GUEST_GAME_NOT_AVAILABLE',
      message: 'Ce jeu n’est pas disponible en mode invité.'
    });
  }

  private sessionNotFound() {
    return new NotFoundException({
      code: 'GUEST_GAME_SESSION_NOT_FOUND',
      message: 'Cette partie invitée est introuvable.'
    });
  }

  private guestUnavailable() {
    return new ConflictException({
      code: 'GUEST_GAME_IDENTITY_NOT_ACTIVE',
      message: 'Cette identité invitée ne peut plus jouer.'
    });
  }

  private staleSession() {
    return new ConflictException({
      code: 'GAME_SESSION_STALE',
      message: 'La partie a changé. Recharge son état avant de rejouer.'
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
