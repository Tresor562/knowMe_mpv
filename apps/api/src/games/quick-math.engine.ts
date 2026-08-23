import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  GameApplyInput,
  GameApplyResult,
  GameCatalogDefinition,
  GameEngineAdapter
} from './game-platform.domain';

type QuickMathOperator = '+' | '-';

type QuickMathQuestion = {
  left: number;
  right: number;
  operator: QuickMathOperator;
};

type QuickMathOutcome = {
  round: number;
  submittedAnswer: number;
  correctAnswer: number;
  correct: boolean;
};

export type QuickMathState = {
  engine: 'QUICK_MATH_V1';
  phase: 'READY' | 'ACTIVE' | 'COMPLETED';
  round: number;
  maxRounds: number;
  score: number;
  question: QuickMathQuestion | null;
  lastOutcome: QuickMathOutcome | null;
  completed: boolean;
};

export const QUICK_MATH_DEFINITION: GameCatalogDefinition = {
  key: 'quick-math',
  version: 1,
  name: 'Quick Math',
  description: 'Cinq calculs courts générés de manière déterministe et corrigés par le serveur.',
  engineKey: 'QUICK_MATH_V1',
  minPlayers: 1,
  maxPlayers: 1,
  rules: {
    startAction: 'START',
    answerAction: 'ANSWER',
    rounds: 5,
    operators: ['+', '-'],
    serverGeneratedQuestions: true,
    clientScoreAccepted: false,
    clientWinnerAccepted: false,
    economicStakeAllowed: false
  },
  initialConfig: { rounds: 5 }
};

export class QuickMathEngine implements GameEngineAdapter {
  readonly engineKey = 'QUICK_MATH_V1';

  createInitialState(playerCount: number): QuickMathState {
    if (playerCount !== 1) {
      throw new BadRequestException({
        code: 'GAME_PLAYER_COUNT_INVALID',
        message: 'Quick Math nécessite exactement un joueur.'
      });
    }

    return {
      engine: 'QUICK_MATH_V1',
      phase: 'READY',
      round: 0,
      maxRounds: 5,
      score: 0,
      question: null,
      lastOutcome: null,
      completed: false
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
    if (input.actorPosition !== 0) {
      throw new ConflictException({
        code: 'GAME_NOT_YOUR_TURN',
        message: 'Cette action n’appartient pas à ce joueur.'
      });
    }

    if (input.actionType === 'START') {
      return this.start(state, input.seed);
    }
    if (input.actionType === 'ANSWER') {
      return this.answer(state, input.payload, input.seed);
    }

    throw new BadRequestException({
      code: 'GAME_ACTION_UNSUPPORTED',
      message: 'Cette action n’est pas prise en charge par ce jeu.'
    });
  }

  publicState(value: unknown) {
    const state = this.parseState(value);
    return {
      engine: state.engine,
      phase: state.phase,
      round: state.round,
      maxRounds: state.maxRounds,
      score: state.score,
      question: state.question,
      lastOutcome: state.lastOutcome,
      completed: state.completed
    };
  }

  private start(state: QuickMathState, seed: string): GameApplyResult {
    if (state.phase !== 'READY' || state.round !== 0 || state.question !== null) {
      throw new ConflictException({
        code: 'GAME_ALREADY_STARTED',
        message: 'Cette partie a déjà commencé.'
      });
    }

    const next: QuickMathState = {
      ...state,
      phase: 'ACTIVE',
      round: 1,
      question: deterministicQuickMathQuestion(seed, 1)
    };

    return {
      state: next,
      currentTurnPosition: 0,
      completed: false,
      winnerPosition: null,
      result: null
    };
  }

  private answer(state: QuickMathState, payload: unknown, seed: string): GameApplyResult {
    if (state.phase !== 'ACTIVE' || !state.question || state.round < 1) {
      throw new ConflictException({
        code: 'GAME_NOT_STARTED',
        message: 'La partie doit être démarrée avant de répondre.'
      });
    }

    const submittedAnswer = this.parseAnswer(payload);
    const correctAnswer = solveQuickMathQuestion(state.question);
    const correct = submittedAnswer === correctAnswer;
    const score = state.score + (correct ? 1 : 0);
    const lastOutcome: QuickMathOutcome = {
      round: state.round,
      submittedAnswer,
      correctAnswer,
      correct
    };

    if (state.round >= state.maxRounds) {
      const next: QuickMathState = {
        ...state,
        phase: 'COMPLETED',
        score,
        question: null,
        lastOutcome,
        completed: true
      };
      return {
        state: next,
        currentTurnPosition: null,
        completed: true,
        winnerPosition: null,
        result: {
          outcome: 'COMPLETED',
          score,
          correctAnswers: score,
          rounds: state.maxRounds
        }
      };
    }

    const nextRound = state.round + 1;
    const next: QuickMathState = {
      ...state,
      round: nextRound,
      score,
      question: deterministicQuickMathQuestion(seed, nextRound),
      lastOutcome
    };
    return {
      state: next,
      currentTurnPosition: 0,
      completed: false,
      winnerPosition: null,
      result: null
    };
  }

  private parseAnswer(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException({
        code: 'GAME_ACTION_PAYLOAD_INVALID',
        message: 'La réponse est invalide.'
      });
    }
    const record = payload as Record<string, unknown>;
    if (Object.keys(record).length !== 1 || !Number.isInteger(record.answer)) {
      throw new BadRequestException({
        code: 'GAME_ACTION_PAYLOAD_INVALID',
        message: 'La réponse est invalide.'
      });
    }
    const answer = Number(record.answer);
    if (answer < -100 || answer > 100) {
      throw new BadRequestException({
        code: 'GAME_ACTION_VALUE_OUT_OF_RANGE',
        message: 'La réponse doit être comprise entre -100 et 100.'
      });
    }
    return answer;
  }

  private parseState(value: unknown): QuickMathState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid Quick Math state.');
    }
    const state = value as Partial<QuickMathState>;
    if (
      state.engine !== 'QUICK_MATH_V1' ||
      !['READY', 'ACTIVE', 'COMPLETED'].includes(state.phase ?? '') ||
      !Number.isInteger(state.round) ||
      !Number.isInteger(state.maxRounds) ||
      !Number.isInteger(state.score) ||
      typeof state.completed !== 'boolean'
    ) {
      throw new Error('Invalid Quick Math state.');
    }
    return state as QuickMathState;
  }
}

export function deterministicQuickMathQuestion(seed: string, round: number): QuickMathQuestion {
  if (!Number.isInteger(round) || round < 1) {
    throw new Error('Quick Math round must be a positive integer.');
  }
  const digest = createHash('sha256').update(`${seed}:quick-math:${round}`).digest();
  const first = (digest[0] % 10) + 1;
  const second = (digest[1] % 10) + 1;
  const operator: QuickMathOperator = digest[2] % 2 === 0 ? '+' : '-';

  if (operator === '-') {
    return {
      left: Math.max(first, second),
      right: Math.min(first, second),
      operator
    };
  }
  return { left: first, right: second, operator };
}

export function solveQuickMathQuestion(question: QuickMathQuestion) {
  return question.operator === '+'
    ? question.left + question.right
    : question.left - question.right;
}
