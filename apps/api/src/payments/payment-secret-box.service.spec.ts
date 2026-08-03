import { ConfigService } from '@nestjs/config';
import { PaymentSecretBoxService } from './payment-secret-box.service';

describe('PaymentSecretBoxService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const config = new ConfigService({
    PAYMENTS_DATA_ENCRYPTION_KEY: key
  });
  const service = new PaymentSecretBoxService(config);

  it('encrypts and decrypts a purchase proof with contextual integrity', () => {
    const encrypted = service.encrypt(
      'purchase-token-sensitive',
      'payment-order:KM-TEST'
    );
    expect(encrypted).not.toContain('purchase-token-sensitive');
    expect(
      service.decrypt(encrypted, 'payment-order:KM-TEST')
    ).toBe('purchase-token-sensitive');
  });

  it('rejects a ciphertext reused with another order context', () => {
    const encrypted = service.encrypt('proof', 'payment-order:ONE');
    expect(() => service.decrypt(encrypted, 'payment-order:TWO')).toThrow();
  });
});
