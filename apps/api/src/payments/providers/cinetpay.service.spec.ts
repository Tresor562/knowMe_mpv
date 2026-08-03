import { ConfigService } from '@nestjs/config';
import { hmacSha256Hex } from '../payment-crypto';
import { CinetPayService } from './cinetpay.service';

describe('CinetPayService', () => {
  const secret = 'cinetpay-test-secret-not-production';
  const service = new CinetPayService(
    new ConfigService({
      CINETPAY_API_KEY: 'api-key-placeholder',
      CINETPAY_SITE_ID: '123456',
      CINETPAY_SECRET: secret
    })
  );

  it('validates x-token from the documented ordered notification fields', () => {
    const payload: Record<string, unknown> = {
      cpm_site_id: '123456',
      cpm_trans_id: 'KM-CNP-ABC',
      cpm_trans_date: '2026-08-03 10:00:00',
      cpm_amount: '12000',
      cpm_currency: 'XOF',
      signature: 'provider-signature',
      payment_method: 'MOBILE_MONEY',
      cel_phone_num: '00000000',
      cpm_phone_prefixe: '229',
      cpm_language: 'fr',
      cpm_version: 'V2',
      cpm_payment_config: 'SINGLE',
      cpm_page_action: 'PAYMENT',
      cpm_custom: 'order',
      cpm_designation: 'KnowMe Premium',
      cpm_error_message: ''
    };
    const material = Object.values(payload).join('');
    const token = hmacSha256Hex(secret, material);
    expect(service.verifyWebhookSignature(payload, token)).toBe(true);
    expect(service.verifyWebhookSignature(payload, `${token}x`)).toBe(false);
  });
});
