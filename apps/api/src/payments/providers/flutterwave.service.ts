import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchProviderJson } from '../payment-http';
import { majorToMinor, minorToMajorString } from '../payment-money';
import {
  constantTimeEquals,
  hmacSha256Base64,
  sha256Hex
} from '../payment-crypto';
import {
  CreateProviderCheckoutInput,
  ParsedProviderWebhook,
  ProviderCheckoutResult,
  ProviderRefundResult,
  RefundProviderPaymentInput,
  VerifiedProviderPayment,
  VerifyProviderPaymentInput
} from '../payment-provider.types';

const API_URL = 'https://api.flutterwave.com/v3';

@Injectable()
export class FlutterwaveService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.secretKey() && this.webhookSecret());
  }

  async createPayment(
    input: CreateProviderCheckoutInput
  ): Promise<ProviderCheckoutResult> {
    const secretKey = this.requireSecretKey();
    const response = await fetchProviderJson<{
      status?: string;
      data?: { link?: string; id?: string | number };
    }>('Flutterwave', `${API_URL}/payments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: minorToMajorString(input.amount, input.currency),
        currency: input.currency,
        redirect_url: input.returnUrl,
        customer: {
          email: input.customer.email,
          name: input.customer.displayName,
          phonenumber: input.customer.phoneNumber
        },
        customizations: {
          title: 'KnowMe',
          description: input.description
        },
        meta: input.metadata
      })
    });

    const checkoutUrl = response.data?.link;
    if (response.status !== 'success' || !checkoutUrl) {
      throw new ServiceUnavailableException(
        'Flutterwave n’a pas créé de lien de paiement.'
      );
    }
    return {
      providerCheckoutId: response.data?.id ? String(response.data.id) : null,
      checkoutUrl,
      raw: response as Record<string, unknown>
    };
  }

  async verifyPayment(
    input: VerifyProviderPaymentInput
  ): Promise<VerifiedProviderPayment> {
    const secretKey = this.requireSecretKey();
    const response = await fetchProviderJson<{
      status?: string;
      data?: Record<string, unknown> & {
        id?: string | number;
        tx_ref?: string;
        amount?: number | string;
        currency?: string;
        status?: string;
        payment_type?: string;
        created_at?: string;
      };
    }>(
      'Flutterwave',
      `${API_URL}/transactions/${encodeURIComponent(input.externalTransactionId)}/verify`,
      { headers: { authorization: `Bearer ${secretKey}` } }
    );

    const data = response.data ?? {};
    const rawStatus = String(data.status ?? response.status ?? 'unknown').toLowerCase();
    const status = rawStatus === 'successful'
      ? 'SUCCESS'
      : rawStatus === 'pending'
        ? 'PENDING'
        : rawStatus.includes('refund')
          ? 'REFUNDED'
          : rawStatus.includes('cancel')
            ? 'CANCELED'
            : 'FAILED';
    const currency = String(data.currency ?? '').toUpperCase();
    return {
      status,
      externalTransactionId: String(data.id ?? input.externalTransactionId),
      reference: String(data.tx_ref ?? ''),
      amount: majorToMinor(data.amount ?? 0, currency || input.expectedCurrency),
      currency,
      paidAt: data.created_at ? new Date(data.created_at) : undefined,
      paymentMethod: data.payment_type ? String(data.payment_type) : undefined,
      rawStatus,
      raw: response as Record<string, unknown>
    };
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
    legacyVerificationHash?: string
  ) {
    const secret = this.requireWebhookSecret();
    if (signature) {
      const expected = hmacSha256Base64(secret, rawBody);
      return constantTimeEquals(expected, signature.trim());
    }
    return Boolean(
      legacyVerificationHash &&
      constantTimeEquals(secret, legacyVerificationHash.trim())
    );
  }

  parseWebhook(rawBody: Buffer): ParsedProviderWebhook {
    const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const eventType = String(payload.type ?? payload.event ?? 'UNKNOWN');
    const explicitId = payload.id ?? payload.webhook_id;
    const externalEventId = explicitId
      ? String(explicitId)
      : `flw-${sha256Hex(rawBody).slice(0, 48)}`;
    return {
      externalEventId,
      externalTransactionId: data.id ? String(data.id) : undefined,
      reference: data.reference
        ? String(data.reference)
        : data.tx_ref
          ? String(data.tx_ref)
          : undefined,
      eventType,
      raw: payload
    };
  }

  async refundPayment(
    input: RefundProviderPaymentInput
  ): Promise<ProviderRefundResult> {
    const secretKey = this.requireSecretKey();
    const response = await fetchProviderJson<{
      status?: string;
      data?: Record<string, unknown> & {
        id?: string | number;
        flw_ref?: string;
        status?: string;
      };
    }>(
      'Flutterwave',
      `${API_URL}/transactions/${encodeURIComponent(input.externalTransactionId)}/refund`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secretKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          amount: input.amount,
          comments: input.reason,
          callbackurl: input.callbackUrl
        })
      }
    );
    const data = response.data ?? {};
    const externalRefundId = data.id ?? data.flw_ref;
    if (!externalRefundId) {
      throw new ServiceUnavailableException(
        'Flutterwave n’a pas retourné de référence de remboursement.'
      );
    }
    return {
      externalRefundId: String(externalRefundId),
      status: String(data.status ?? response.status ?? 'processing'),
      raw: response as Record<string, unknown>
    };
  }

  assertWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
    legacyVerificationHash?: string
  ) {
    if (!this.verifyWebhookSignature(rawBody, signature, legacyVerificationHash)) {
      throw new UnauthorizedException('Signature Flutterwave invalide.');
    }
  }

  private secretKey() {
    return this.config.get<string>('FLUTTERWAVE_SECRET_KEY')?.trim();
  }

  private webhookSecret() {
    return this.config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET')?.trim();
  }

  private requireSecretKey() {
    const value = this.secretKey();
    if (!value) {
      throw new ServiceUnavailableException('Flutterwave n’est pas configuré.');
    }
    return value;
  }

  private requireWebhookSecret() {
    const value = this.webhookSecret();
    if (!value) {
      throw new ServiceUnavailableException(
        'Le secret webhook Flutterwave n’est pas configuré.'
      );
    }
    return value;
  }
}
