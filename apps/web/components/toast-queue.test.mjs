import assert from 'node:assert/strict';
import test from 'node:test';
import { enqueueNotice } from './toast-queue.ts';

const notice = (id, text, tone = 'error') => ({ id, text, tone });

test('distinct notices queue without losing the active notice', () => {
  const first = [notice(1, 'first')];
  const second = enqueueNotice(first, notice(2, 'second'));
  assert.deepEqual(second.map(item => item.text), ['first', 'second']);
  assert.deepEqual(first, [notice(1, 'first')]);
});

test('duplicate bursts are ignored and recent alerts fit in the capped queue', () => {
  const first = [notice(1, 'error'), notice(2, 'ok', 'success')];
  assert.equal(enqueueNotice(first, notice(3, 'error')), first);
  const full = [notice(1, 'one'), notice(2, 'two'), notice(3, 'three'), notice(4, 'four')];
  const next = enqueueNotice(full, notice(5, 'five'));
  assert.equal(next.length, 4);
  assert.deepEqual(next.map(item => item.id), [1, 2, 3, 5]);
});
