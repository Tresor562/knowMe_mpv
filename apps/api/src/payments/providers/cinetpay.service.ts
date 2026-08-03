import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchProviderJson } from '../payment-http';
import { majorToMinor, minorToMajorString } from '../payment-money';
import {
  constantTimeEquals,
  hmacSha256Hex,
  sha256Hex
} from '../payment-crypto';
import {
  CreateProviderCheckoutInput,
  ParsedProviderWebhook,
  ProviderCheckoutResult,
  VerifiedProviderPayment,
  VerifyProviderPaymentInput
} from '../payment-provider.types';

const INITIALIZE_URL = 'https://api-checkout.cinetpay.com/v2/payment';
const VERIFY_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';
const HMAC_FIELDS = [
  'cpm_site_id',
  'cpm_trans_id',
  'cpm_trans_date',
  'cpm_amount',
  'cpm_currency',
  'signature',
  'payment_method',
  'cel_phone_num',
  'cpm_phone_prefixe',
  'cpm_language',
  'cpm_version',
  'cpm_payment_config',
  'cpm_page_action',
  'cpm_custom',
  'cpm_designation',
  'cpm_error_message'
] as const;

@Injectable()
export class CinetPayService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.apiKey() && this.siteId() && this.secret());
  }

  async createPayment(
    input: CreateProviderCheckoutInput
  ): Promise<ProviderCheckoutResult> {
    const amount = Number(minorToMajorString(input.amount, input.currency));
    if (!Number.isSafeInteger(amount)) {
      throw new BadRequestException(
        'CinetPay exige un prix exprimé en unité monétaire entière.'
      );
    }
    if (input.currency !== 'USD' && amount % 5 !== 0) {
      throw new BadRequestException(
        'Le montant CinetPay doit être un multiple de 5 pour cette devise.'
      );
    }

    const response = await fetchProviderJson<{
      code?: string;
      message?: string;
      data?: { payment_token?: string; payment_url?: string };
    }>('CinetPay', INITIALIZE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apikey: this.requireApiKey(),
        site_id: this.requireSiteId(),
        transaction_id: input.reference.replace(/[^A-Za-z0-9-]/g, ''),
        amount,
        currency: input.currency,
        description: input.description.replace(/[#/$&_]/g, ' ').slice(0, 180),
        notify_url: input.notifyUrl,
        return_url: input.returnUrl,
        channels: 'ALL',
        lang: 'FR',
        metadata: JSON.stringify(input.metadata),
        customer_id: input.customer.id,
        customer_name: input.customer.displayName,
        customer_surname: input.customer.displayName,
        customer_email: input.customer.email,
        customer_phone_number: input.customer.phoneNumber,
        customer_address: input.customer.address,
        customer_city: input.customer.city,
        customer_country: input.customer.countryCode,
        customer_state: input.customer.state,
        customer_zip_code: input.customer.postalCode
      })
    });

    const checkoutUrl = response.data?.payment_url;
    if (response.code !== '201' || !checkoutUrl) {
      throw new ServiceUnavailableException(
        'CinetPay n’a pas créé de lien de paiement.'
      );
    }
    return {
      providerCheckoutId: response.data?.payment_token ?? null,
      checkoutUrl,
      raw: response as Record<string, unknown>
    };
  }

  async verifyPayment(
    input: VerifyProviderPaymentInput
  ): Promise<VerifiedProviderPayment> {
    const response = await fetchProviderJson<{
      code?: string;
      message?: string;
      data?: Record<string, unknown> & {
        status?: string;
        transaction_id?: string;
        amount?: number | string;
        currency?: string;
        payment_method?: string;
        payment_date?: string;
      };
    }>('CinetPay', VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apikey: this.requireApiKey(),
        site_id: this.requireSiteId(),
        transaction_id: input.expectedReference
      })
    });

    const data = response.data ?? {};
    const rawStatus = String(data.status ?? response.message ?? 'unknown').toUpperCase();
    const status = rawStatus === 'ACCEPTED'
      ? 'SUCCESS'
      : rawStatus.includes('WAITING') || rawStatus.includes('PENDING')
        ? 'PENDING'
        : rawStatus.includes('CANCEL')
          ? 'CANCELED'
          : rawStatus.includes('REFUND')
            ? 'REFUNDED'
            : 'FAILED';
    const currency = String(data.currency ?? input.expectedCurrency).toUpperCase();
    return {
      status,
      externalTransactionId: input.externalTransactionId,
      reference: String(data.transaction_id ?? input.expectedReference),
      amount: majorToMinor(data.amount ?? 0, currency),
      currency,
      paidAt: data.payment_date ? new Date(data.payment_date) : undefined,
      paymentMethod: data.payment_method ? String(data.payment_method) : undefined,
      rawStatus,
      raw: response as Record<string, unknown>
    };
  }

  verifyWebhookSignature(
    payload: Record<string, unknown>,
    receivedToken: string | undefined
  ) {
    const material = HMAC_FIELDS.map((field) => String(payload[field] ?? '')).join('');
    const expected = hmacSha256Hex(this.requireSecret(), material);
    return Boolean(receivedToken && constantTimeEquals(expected, receivedToken.trim()));
  }

  assertWebhookSignature(
    payload: Record<string, unknown>,
    receivedToken: string | undefined
  ) {
    if (!this.verifyWebhookSignature(payload, receivedToken)) {
      throw new UnauthorizedException('Signature CinetPay invalide.');
    }
  }

  parseWebhook(
    payload: Record<string, unknown>,
    rawBody: Buffer
  ): ParsedProviderWebhook {
    const reference = String(payload.cpm_trans_id ?? '');
    const rawStatus = String(payload.cpm_result ?? payload.cpm_error_message ?? 'UNKNOWN');
    return {
      externalEventId: `cinetpay-${sha256Hex(`${reference}:${rawStatus}:${sha256Hex(rawBody)}`).slice(0, 48)}`,
      externalTransactionId: reference || undefined,
      reference: reference || undefined,
      eventType: rawStatus,
      raw: payload
    };
  }

  private apiKey() {
    return this.config.get<string>('CINETPAY_API_KEY')?.trim();
  }

  private siteId() {
    return this.config.get<string>('CINETPAY_SITE_ID')?.trim();
  }

  private secret() {
    return this.config.get<string>('CINETPAY_SECRET')?.trim();
  }

  private requireApiKey() {
    const value = this.apiKey();
    if (!value) throw new ServiceUnavailableException('CinetPay n’est pas configuré.');
    return value;
  }

  private requireSiteId() {
    const value = this.siteId();
    if (!value) throw new ServiceUnavailableException('CinetPay n’est pas configuré.');
    return value;
  }

  private requireSecret() {
    const value = this.secret();
    if (!value) {
      throw new ServiceUnavailableException(
        'Le secret webhook CinetPay n’est pas configuré.'
      );
    }
    return value;
  }
}
