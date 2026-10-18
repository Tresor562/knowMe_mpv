import assert from 'node:assert/strict';
import test from 'node:test';
import { GiftSendAttemptRegistry } from './gift-send-attempts.ts';

test('a lost response retains the exact same gift send key', () => {
  let generated = 0;
  const registry = new GiftSendAttemptRegistry(() => 'intent-' + ++generated);
  const intent = { recipientId: 'friend', giftKey: 'rose', message: 'Merci' };
  assert.equal(registry.keyFor(intent), 'intent-1');
  assert.equal(registry.keyFor({ ...intent }), 'intent-1');
  assert.equal(generated, 1);
});

test('recipient, gift and message changes each represent a distinct operation', () => {
  let n = 0;
  const registry = new GiftSendAttemptRegistry(() => String(++n));
  assert.equal(registry.keyFor({ recipientId: 'one', giftKey: 'rose', message: '' }), '1');
  assert.equal(registry.keyFor({ recipientId: 'two', giftKey: 'rose', message: '' }), '2');
  assert.equal(registry.keyFor({ recipientId: 'one', giftKey: 'heart', message: '' }), '3');
  assert.equal(registry.keyFor({ recipientId: 'one', giftKey: 'rose', message: 'Bonjour' }), '4');
});

test('only an acknowledged receipt releases the attempted ID', () => {
  let n = 0;
  const registry = new GiftSendAttemptRegistry(() => String(++n));
  const intent = { recipientId: 'friend', giftKey: 'rose', message: '' };
  const first = registry.keyFor(intent);
  assert.equal(registry.keyFor(intent), first);
  registry.acknowledge(intent);
  assert.notEqual(registry.keyFor(intent), first);
});
