import {
  billingPayloadHash,
  canonicalBillingPayload,
  secureSignatureEquals,
  signBillingPayload
} from './billing-signature';

describe('billing signatures', () => {
  it('signs equivalent objects identically regardless of property order', () => {
    const first = {
      status: 'ACTIVE',
      accountId: 'account_1',
      metadata: { source: 'test', attempt: 1 },
      items: [{ key: 'premium.core', enabled: true }]
    };
    const second = {
      items: [{ enabled: true, key: 'premium.core' }],
      metadata: { attempt: 1, source: 'test' },
      accountId: 'account_1',
      status: 'ACTIVE'
    };

    expect(canonicalBillingPayload(first)).toBe(canonicalBillingPayload(second));
    expect(billingPayloadHash(first)).toBe(billingPayloadHash(second));
    expect(signBillingPayload('secret-value', '1700000000', first)).toBe(
      signBillingPayload('secret-value', '1700000000', second)
    );
  });

  it('uses constant-time compatible hexadecimal comparison', () => {
    const signature = signBillingPayload('secret-value', '1700000000', {
      eventId: 'event_1'
    });

    expect(secureSignatureEquals(signature, signature)).toBe(true);
    expect(secureSignatureEquals(signature, '0'.repeat(64))).toBe(false);
    expect(secureSignatureEquals(signature, 'not-hex')).toBe(false);
  });
});
