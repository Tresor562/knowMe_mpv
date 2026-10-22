export type GiftSendIntent = {
  recipientId: string;
  giftKey: string;
  message: string;
};

export function giftSendIntentIdentity(intent: GiftSendIntent): string {
  // A changed recipient or message is a new intentional transaction.
  return JSON.stringify([intent.recipientId, intent.giftKey, intent.message]);
}

/** Retains one server idempotency key after an uncertain network response. */
export class GiftSendAttemptRegistry {
  private readonly pending = new Map<string, string>();
  constructor(private readonly createId: (recipientId: string, giftKey: string) => string) {}

  keyFor(intent: GiftSendIntent): string {
    const identity = giftSendIntentIdentity(intent);
    const existing = this.pending.get(identity);
    if (existing) return existing;
    const next = this.createId(intent.recipientId, intent.giftKey);
    this.pending.set(identity, next);
    return next;
  }

  acknowledge(intent: GiftSendIntent) {
    this.pending.delete(giftSendIntentIdentity(intent));
  }
}
