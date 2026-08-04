import { ConflictException } from '@nestjs/common';
import {
  AffinityMirrorEngine,
  sanitizeAffinityReplay
} from './affinity-mirror.engine';
import {
  redactAffinityStoredResult,
  redactAffinityStoredState
} from './affinity-data-redaction';

describe('Affinity Mirror engine', () => {
  const seed = 'unused-but-authoritative';

  function apply(
    engine: AffinityMirrorEngine,
    state: unknown,
    actorPosition: number,
    actionType: string,
    payload: Record<string, unknown>
  ) {
    return engine.apply({
      state,
      actorPosition,
      actionType,
      payload,
      seed
    });
  }

  it('requires explicit consent and does not expose individual sharing choices', () => {
    const engine = new AffinityMirrorEngine();
    const initial = engine.createInitialState(2);
    expect(() =>
      apply(engine, initial, 0, 'ANSWER', { option: 1 })
    ).toThrow();

    const first = apply(engine, initial, 0, 'CONSENT', {
      accepted: true,
      shareAnswers: true
    });
    const publicFirst = engine.publicState(first.state);
    expect(publicFirst).toEqual(
      expect.objectContaining({ phase: 'CONSENT', consentCount: 1 })
    );
    expect(JSON.stringify(publicFirst)).not.toContain('shareAnswers');
    expect(() =>
      apply(engine, first.state, 0, 'CONSENT', {
        accepted: true,
        shareAnswers: true
      })
    ).toThrow(ConflictException);

    const second = apply(engine, first.state, 1, 'CONSENT', {
      accepted: true,
      shareAnswers: false
    });
    expect(engine.publicState(second.state)).toEqual(
      expect.objectContaining({
        phase: 'QUESTIONS',
        consentCount: 2,
        questionIndex: 0,
        questionCount: 6
      })
    );
  });

  it('hides pending answers and produces an explainable non-diagnostic result', () => {
    const engine = new AffinityMirrorEngine();
    let state: unknown = engine.createInitialState(2);
    state = apply(engine, state, 0, 'CONSENT', {
      accepted: true,
      shareAnswers: true
    }).state;
    state = apply(engine, state, 1, 'CONSENT', {
      accepted: true,
      shareAnswers: false
    }).state;

    for (let question = 0; question < 6; question += 1) {
      const publicBefore = engine.publicState(state) as {
        questionIndex: number;
        answeredPositions: number[];
      };
      expect(publicBefore.questionIndex).toBe(question);
      const starter = question % 2 === 0 ? 0 : 1;
      const first = apply(engine, state, starter, 'ANSWER', {
        option: question % 4
      });
      const publicPending = engine.publicState(first.state);
      expect(publicPending.answeredPositions).toEqual([starter]);
      expect(JSON.stringify(publicPending)).not.toContain(`"option":${question % 4}`);
      const second = apply(
        engine,
        first.state,
        starter === 0 ? 1 : 0,
        'ANSWER',
        { option: (question + 1) % 4 }
      );
      state = second.state;
    }

    const publicFinal = engine.publicState(state) as {
      completed: boolean;
      winnerPosition: null;
      summary: {
        overallScore: number;
        categories: unknown[];
        explanations: string[];
        disclaimer: string;
        detailedAnswersShared: boolean;
        answerDetails?: unknown;
      };
    };
    expect(publicFinal.completed).toBe(true);
    expect(publicFinal.winnerPosition).toBeNull();
    expect(publicFinal.summary.overallScore).toBeGreaterThanOrEqual(0);
    expect(publicFinal.summary.overallScore).toBeLessThanOrEqual(100);
    expect(publicFinal.summary.categories).toHaveLength(3);
    expect(publicFinal.summary.explanations).toHaveLength(3);
    expect(publicFinal.summary.disclaimer).toContain('ni un test psychologique');
    expect(publicFinal.summary.detailedAnswersShared).toBe(false);
    expect(publicFinal.summary.answerDetails).toBeUndefined();
  });

  it('shares detailed answers only after mutual consent and redacts other replays', () => {
    const engine = new AffinityMirrorEngine();
    let state: unknown = engine.createInitialState(2);
    const actions: Array<{
      sequence: number;
      actorId: string;
      actionType: string;
      payload: Record<string, unknown>;
      stateHashBefore: string;
      stateHashAfter: string;
      createdAt: Date;
    }> = [];
    let sequence = 0;

    function record(
      actorPosition: 0 | 1,
      actionType: string,
      payload: Record<string, unknown>
    ) {
      const before = JSON.stringify(state);
      const result = apply(engine, state, actorPosition, actionType, payload);
      state = result.state;
      sequence += 1;
      actions.push({
        sequence,
        actorId: `u${actorPosition}`,
        actionType,
        payload,
        stateHashBefore: before,
        stateHashAfter: JSON.stringify(state),
        createdAt: new Date()
      });
      return result;
    }

    record(0, 'CONSENT', { accepted: true, shareAnswers: true });
    record(1, 'CONSENT', { accepted: true, shareAnswers: true });
    let completed: ReturnType<typeof record> | undefined;
    for (let question = 0; question < 6; question += 1) {
      const starter = question % 2 === 0 ? 0 : 1;
      record(starter, 'ANSWER', { option: question % 4 });
      completed = record(starter === 0 ? 1 : 0, 'ANSWER', {
        option: question % 4
      });
    }
    expect(completed?.completed).toBe(true);
    expect(completed?.result).toEqual(
      expect.objectContaining({
        detailedAnswersShared: true,
        answerDetails: expect.any(Array)
      })
    );

    const shared = sanitizeAffinityReplay({
      initialState: engine.createInitialState(2),
      finalState: state,
      result: completed?.result,
      actions
    });
    expect(shared.privacyRedacted).toBe(false);
    expect(shared.reproducibleByParticipant).toBe(true);
    expect(shared.actions.some((action) => action.payload.option === 0)).toBe(true);

    const privateResult = {
      ...(completed?.result ?? {}),
      detailedAnswersShared: false,
      answerDetails: undefined
    };
    const privateReplay = sanitizeAffinityReplay({
      initialState: engine.createInitialState(2),
      finalState: state,
      result: privateResult,
      actions
    });
    expect(privateReplay.privacyRedacted).toBe(true);
    expect(privateReplay.reproducibleByParticipant).toBe(false);
    expect(
      privateReplay.actions
        .filter((action) => action.actionType === 'ANSWER')
        .every((action) => action.payload.redacted === true)
    ).toBe(true);
  });

  it('removes a deleted participant answers from stored state and result', () => {
    const stored = {
      engine: 'AFFINITY_MIRROR_V1',
      phase: 'COMPLETED',
      turnPosition: 0,
      consented: [true, true],
      shareAnswers: [true, true],
      questionIndex: 5,
      pendingAnswers: [1, 2],
      rounds: [
        {
          questionKey: 'q',
          category: 'TRUST',
          answers: [1, 3],
          distance: 2,
          points: 33,
          exact: false
        }
      ],
      completed: true,
      summary: {
        detailedAnswersShared: true,
        answerDetails: [{ firstChoice: 'A', secondChoice: 'B' }]
      }
    };
    const redacted = redactAffinityStoredState(stored, 1);
    expect(redacted.shareAnswers).toEqual([false, false]);
    expect(redacted.pendingAnswers).toEqual([1, null]);
    expect((redacted.rounds as Array<{ answers: unknown[] }>)[0].answers).toEqual([
      1,
      null
    ]);
    expect(redacted.summary).toEqual({ detailedAnswersShared: false });
    expect(
      redactAffinityStoredResult({
        detailedAnswersShared: true,
        answerDetails: ['private'],
        overallScore: 42
      })
    ).toEqual({ detailedAnswersShared: false, overallScore: 42 });
  });
});
