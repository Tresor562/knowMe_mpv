import {
  paymentAccountReference,
  redactPaymentPayload
} from './payment-security';

describe('payment-security', () => {
  it('creates deterministic provider-specific account references', () => {
    const google = paymentAccountReference('user-1', 'GOOGLE_PLAY');
    const apple = paymentAccountReference('user-1', 'APPLE_APP_STORE');
    expect(google).toHaveLength(64);
    expect(apple).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(paymentAccountReference('user-1', 'GOOGLE_PLAY')).toBe(google);
    expect(paymentAccountReference('user-2', 'GOOGLE_PLAY')).not.toBe(google);
  });

  it('redacts payment credentials and personal fields from logs', () => {
    expect(
      redactPaymentPayload({
        authorization: 'Bearer secret',
        purchaseToken: 'sensitive',
        email: 'person@example.com',
        amount: 2000,
        nested: { cardNumber: '4111111111111111', status: 'ok' }
      })
    ).toEqual({
      authorization: '[REDACTED]',
      purchaseToken: '[REDACTED]',
      email: '[REDACTED]',
      amount: 2000,
      nested: { cardNumber: '[REDACTED]', status: 'ok' }
    });
  });
});
