import { ConflictException } from '@nestjs/common';
import {
  PulseDuelEngine,
  canonicalJson,
  deterministicTarget,
  sha256Json
} from './game-platform.domain';

describe('Authoritative game platform domain', () => {
  const seed = '0123456789abcdef'.repeat(4);

  it('canonicalizes and hashes object keys deterministically', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe(
      '{"a":{"x":3,"y":2},"z":1}'
    );
    expect(sha256Json({ b: 2, a: 1 })).toBe(sha256Json({ a: 1, b: 2 }));
  });

  it('derives the same bounded server target from a seed and round', () => {
    const first = deterministicTarget(seed, 1);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(9);
    expect(deterministicTarget(seed, 1)).toBe(first);
    expect(deterministicTarget(seed, 2)).toBe(deterministicTarget(seed, 2));
  });

  it('keeps the first choice secret and enforces the turn', () => {
    const engine = new PulseDuelEngine();
    const initial = engine.createInitialState(2);
    const first = engine.apply({
      state: initial,
      actorPosition: 0,
      actionType: 'PULSE',
      payload: { value: 4 },
      seed
    });

    expect(engine.publicState(first.state)).toEqual(
      expect.objectContaining({ pendingPosition: 0, turnPosition: 1 })
    );
    expect(JSON.stringify(engine.publicState(first.state))).not.toContain('"value":4');
    expect(() =>
      engine.apply({
        state: first.state,
        actorPosition: 0,
        actionType: 'PULSE',
        payload: { value: 5 },
        seed
      })
    ).toThrow(ConflictException);
  });

  it('computes all five rounds and the final result on the server', () => {
    const engine = new PulseDuelEngine();
    let state = engine.createInitialState(2);
    let result: ReturnType<PulseDuelEngine['apply']> | undefined;

    for (let round = 1; round <= 5; round += 1) {
      const starter = state.turnPosition;
      const first = engine.apply({
        state,
        actorPosition: starter,
        actionType: 'PULSE',
        payload: { value: round },
        seed
      });
      result = engine.apply({
        state: first.state,
        actorPosition: starter === 0 ? 1 : 0,
        actionType: 'PULSE',
        payload: { value: 10 - round },
        seed
      });
      state = result.state as typeof state;
    }

    expect(result).toBeDefined();
    expect(result?.completed).toBe(true);
    expect(result?.currentTurnPosition).toBeNull();
    expect(result?.result).toEqual(
      expect.objectContaining({ rounds: 5, scores: expect.any(Array) })
    );
    expect((result?.state as { completed: boolean }).completed).toBe(true);
  });
});
