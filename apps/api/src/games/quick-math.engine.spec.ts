import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  QuickMathEngine,
  deterministicQuickMathQuestion,
  solveQuickMathQuestion
} from './quick-math.engine';

describe('QuickMathEngine', () => {
  const engine = new QuickMathEngine();

  it('requires exactly one player', () => {
    expect(() => engine.createInitialState(2)).toThrow(BadRequestException);
    expect(engine.createInitialState(1)).toEqual(
      expect.objectContaining({
        engine: 'QUICK_MATH_V1',
        phase: 'READY',
        round: 0,
        score: 0,
        completed: false
      })
    );
  });

  it('generates the same question for the same seed and round', () => {
    expect(deterministicQuickMathQuestion('seed-a', 3)).toEqual(
      deterministicQuickMathQuestion('seed-a', 3)
    );
    expect(deterministicQuickMathQuestion('seed-a', 3)).not.toEqual(
      deterministicQuickMathQuestion('seed-a', 4)
    );
  });

  it('starts deterministically and never accepts a client-provided score', () => {
    const initial = engine.createInitialState(1);
    const started = engine.apply({
      state: initial,
      actorPosition: 0,
      actionType: 'START',
      payload: {},
      seed: 'guest-safe-seed'
    });
    expect(started.completed).toBe(false);
    expect(started.currentTurnPosition).toBe(0);
    expect(started.state).toEqual(
      expect.objectContaining({ phase: 'ACTIVE', round: 1, score: 0 })
    );

    expect(() =>
      engine.apply({
        state: started.state,
        actorPosition: 0,
        actionType: 'ANSWER',
        payload: { answer: 2, score: 999999 },
        seed: 'guest-safe-seed'
      })
    ).toThrow(BadRequestException);
  });

  it('calculates score and final result only from server-side state and answers', () => {
    const seed = 'authoritative-seed';
    let transition = engine.apply({
      state: engine.createInitialState(1),
      actorPosition: 0,
      actionType: 'START',
      payload: {},
      seed
    });

    for (let round = 1; round <= 5; round += 1) {
      const state = transition.state as {
        question: { left: number; right: number; operator: '+' | '-' };
      };
      const answer = solveQuickMathQuestion(state.question);
      transition = engine.apply({
        state: transition.state,
        actorPosition: 0,
        actionType: 'ANSWER',
        payload: { answer },
        seed
      });
    }

    expect(transition.completed).toBe(true);
    expect(transition.currentTurnPosition).toBeNull();
    expect(transition.result).toEqual({
      outcome: 'COMPLETED',
      score: 5,
      correctAnswers: 5,
      rounds: 5
    });
    expect(transition.state).toEqual(
      expect.objectContaining({
        phase: 'COMPLETED',
        score: 5,
        question: null,
        completed: true
      })
    );
  });

  it('rejects answers before start, duplicate starts and foreign actor positions', () => {
    const initial = engine.createInitialState(1);
    expect(() =>
      engine.apply({
        state: initial,
        actorPosition: 0,
        actionType: 'ANSWER',
        payload: { answer: 1 },
        seed: 'seed'
      })
    ).toThrow(ConflictException);

    const started = engine.apply({
      state: initial,
      actorPosition: 0,
      actionType: 'START',
      payload: {},
      seed: 'seed'
    });
    expect(() =>
      engine.apply({
        state: started.state,
        actorPosition: 0,
        actionType: 'START',
        payload: {},
        seed: 'seed'
      })
    ).toThrow(ConflictException);
    expect(() =>
      engine.apply({
        state: started.state,
        actorPosition: 1,
        actionType: 'ANSWER',
        payload: { answer: 1 },
        seed: 'seed'
      })
    ).toThrow(ConflictException);
  });

  it('does not expose any seed or hidden expected answer for the current question', () => {
    const transition = engine.apply({
      state: engine.createInitialState(1),
      actorPosition: 0,
      actionType: 'START',
      payload: {},
      seed: 'do-not-expose-me'
    });
    const publicState = engine.publicState(transition.state) as Record<string, unknown>;
    expect(publicState).not.toHaveProperty('seed');
    expect(JSON.stringify(publicState)).not.toContain('do-not-expose-me');
    expect(publicState).not.toHaveProperty('correctAnswer');
  });
});
