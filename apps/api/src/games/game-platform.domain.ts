import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

export const GAME_SESSION_TERMINAL_STATUSES = [
  'COMPLETED',
  'ABANDONED',
  'CANCELLED',
  'EXPIRED'
] as const;

export type GameSessionTerminalStatus =
  (typeof GAME_SESSION_TERMINAL_STATUSES)[number];

export type GameCatalogDefinition = {
  key: string;
  version: number;
  name: string;
  description: string;
  engineKey: string;
  minPlayers: number;
  maxPlayers: number;
  rules: Record<string, unknown>;
  initialConfig: Record<string, unknown>;
};

export type GameApplyInput = {
  state: unknown;
  actorPosition: number;
  actionType: string;
  payload: unknown;
  seed: string;
};

export type GameApplyResult = {
  state: unknown;
  currentTurnPosition: number | null;
  completed: boolean;
  winnerPosition: number | null;
  result: Record<string, unknown> | null;
};

export interface GameEngineAdapter {
  readonly engineKey: string;
  createInitialState(playerCount: number): unknown;
  apply(input: GameApplyInput): GameApplyResult;
  publicState(state: unknown): unknown;
}

export type PulseDuelState = {
  engine: 'PULSE_DUEL_V1';
  round: number;
  maxRounds: number;
  starterPosition: 0 | 1;
  turnPosition: 0 | 1;
  scores: [number, number];
  pending: { position: 0 | 1; value: number } | null;
  lastOutcome: {
    round: number;
    target: number;
    values: [number, number];
    winnerPosition: 0 | 1 | null;
  } | null;
  completed: boolean;
  winnerPosition: 0 | 1 | null;
};

export class PulseDuelEngine implements GameEngineAdapter {
  readonly engineKey = 'PULSE_DUEL_V1';

  createInitialState(playerCount: number): PulseDuelState {
    if (playerCount !== 2) {
      throw new BadRequestException({
        code: 'GAME_PLAYER_COUNT_INVALID',
        message: 'Pulse Duel nécessite exactement deux joueurs.'
      });
    }
    return {
      engine: 'PULSE_DUEL_V1',
      round: 1,
      maxRounds: 5,
      starterPosition: 0,
      turnPosition: 0,
      scores: [0, 0],
      pending: null,
      lastOutcome: null,
      completed: false,
      winnerPosition: null
    };
  }

  apply(input: GameApplyInput): GameApplyResult {
    const state = this.parseState(input.state);
    if (state.completed) {
      throw new ConflictException({
        code: 'GAME_ALREADY_COMPLETED',
        message: 'Cette partie est déjà terminée.'
      });
    }
    if (input.actionType !== 'PULSE') {
      throw new BadRequestException({
        code: 'GAME_ACTION_UNSUPPORTED',
        message: 'Cette action n’est pas prise en charge par ce jeu.'
      });
    }
    if (input.actorPosition !== state.turnPosition) {
      throw new ConflictException({
        code: 'GAME_NOT_YOUR_TURN',
        message: 'Ce n’est pas ton tour.'
      });
    }
    const value = this.parsePulseValue(input.payload);
    const actorPosition = input.actorPosition as 0 | 1;

    if (!state.pending) {
      const next: PulseDuelState = {
        ...state,
        pending: { position: actorPosition, value },
        turnPosition: (actorPosition === 0 ? 1 : 0) as 0 | 1
      };
      return {
        state: next,
        currentTurnPosition: next.turnPosition,
        completed: false,
        winnerPosition: null,
        result: null
      };
    }

    if (state.pending.position === actorPosition) {
      throw new ConflictException({
        code: 'GAME_DUPLICATE_ROUND_ACTION',
        message: 'Tu as déjà joué pendant cette manche.'
      });
    }

    const values: [number, number] = [0, 0];
    values[state.pending.position] = state.pending.value;
    values[actorPosition] = value;
    const target = deterministicTarget(input.seed, state.round);
    const distance0 = Math.abs(values[0] - target);
    const distance1 = Math.abs(values[1] - target);
    const roundWinner: 0 | 1 | null =
      distance0 === distance1 ? null : distance0 < distance1 ? 0 : 1;
    const scores: [number, number] = [...state.scores];
    if (roundWinner !== null) scores[roundWinner] += 1;

    const lastOutcome = {
      round: state.round,
      target,
      values,
      winnerPosition: roundWinner
    };
    const completed = state.round >= state.maxRounds;
    if (completed) {
      const winnerPosition: 0 | 1 | null =
        scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
      const next: PulseDuelState = {
        ...state,
        scores,
        pending: null,
        lastOutcome,
        completed: true,
        winnerPosition
      };
      return {
        state: next,
        currentTurnPosition: null,
        completed: true,
        winnerPosition,
        result: {
          outcome: winnerPosition === null ? 'DRAW' : 'WIN',
          winnerPosition,
          scores,
          rounds: state.maxRounds
        }
      };
    }

    const starterPosition = (state.starterPosition === 0 ? 1 : 0) as 0 | 1;
    const next: PulseDuelState = {
      ...state,
      round: state.round + 1,
      starterPosition,
      turnPosition: starterPosition,
      scores,
      pending: null,
      lastOutcome,
      winnerPosition: null
    };
    return {
      state: next,
      currentTurnPosition: next.turnPosition,
      completed: false,
      winnerPosition: null,
      result: null
    };
  }

  publicState(value: unknown) {
    const state = this.parseState(value);
    return {
      engine: state.engine,
      round: state.round,
      maxRounds: state.maxRounds,
      starterPosition: state.starterPosition,
      turnPosition: state.turnPosition,
      scores: state.scores,
      pendingPosition: state.pending?.position ?? null,
      lastOutcome: state.lastOutcome,
      completed: state.completed,
      winnerPosition: state.winnerPosition
    };
  }

  private parsePulseValue(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException({
        code: 'GAME_ACTION_PAYLOAD_INVALID',
        message: 'La valeur de jeu est invalide.'
      });
    }
    const record = payload as Record<string, unknown>;
    if (Object.keys(record).length !== 1 || !Number.isInteger(record.value)) {
      throw new BadRequestException({
        code: 'GAME_ACTION_PAYLOAD_INVALID',
        message: 'La valeur de jeu est invalide.'
      });
    }
    const value = Number(record.value);
    if (value < 1 || value > 9) {
      throw new BadRequestException({
        code: 'GAME_ACTION_VALUE_OUT_OF_RANGE',
        message: 'La valeur doit être comprise entre 1 et 9.'
      });
    }
    return value;
  }

  private parseState(value: unknown): PulseDuelState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid Pulse Duel state.');
    }
    const state = value as Partial<PulseDuelState>;
    if (
      state.engine !== 'PULSE_DUEL_V1' ||
      !Number.isInteger(state.round) ||
      !Number.isInteger(state.maxRounds) ||
      (state.turnPosition !== 0 && state.turnPosition !== 1) ||
      !Array.isArray(state.scores) ||
      state.scores.length !== 2 ||
      typeof state.completed !== 'boolean'
    ) {
      throw new Error('Invalid Pulse Duel state.');
    }
    return state as PulseDuelState;
  }
}

export const BUILTIN_GAME_CATALOG: GameCatalogDefinition[] = [
  {
    key: 'pulse-duel',
    version: 1,
    name: 'Pulse Duel',
    description:
      'Un duel relationnel rapide en cinq manches où chaque joueur choisit un nombre secret.',
    engineKey: 'PULSE_DUEL_V1',
    minPlayers: 2,
    maxPlayers: 2,
    rules: {
      action: 'PULSE',
      valueMinimum: 1,
      valueMaximum: 9,
      rounds: 5,
      hiddenFirstChoice: true,
      serverGeneratedTarget: true,
      clientScoreAccepted: false
    },
    initialConfig: { rounds: 5 }
  }
];

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
}

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function gameDefinitionChecksum(definition: GameCatalogDefinition): string {
  return sha256Json(definition);
}

export function deterministicTarget(seed: string, round: number): number {
  const digest = createHash('sha256').update(`${seed}:${round}`).digest();
  return (digest[0] % 9) + 1;
}

export function isTerminalGameStatus(status: string): boolean {
  return GAME_SESSION_TERMINAL_STATUSES.includes(
    status as GameSessionTerminalStatus
  );
}
