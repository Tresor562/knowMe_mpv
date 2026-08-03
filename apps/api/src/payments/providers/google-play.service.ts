import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify } from 'crypto';
import { fetchProviderJson } from '../payment-http';
import {
  decodeBase64UrlJson,
  signJwt
} from '../payment-crypto';
import {
  ParsedProviderWebhook,
  StorePurchaseVerificationInput,
  VerifiedStorePurchase
} from '../payment-provider.types';

const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type AccessToken = { value: string; expiresAt: number };

@Injectable()
export class GooglePlayService {
  private cachedToken: AccessToken | null = null;
  private cachedJwks: { expiresAt: number; keys: JsonWebKey[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.packageName() && this.serviceAccountOrNull());
  }

  async verifyPurchase(
    input: StorePurchaseVerificationInput
  ): Promise<VerifiedStorePurchase> {
    if (!input.purchaseToken) {
      throw new BadRequestException('Jeton d’achat Google Play manquant.');
    }
    return input.kind === 'SUBSCRIPTION'
      ? this.verifySubscription(input)
      : this.verifyOneTimeProduct(input);
  }

  async acknowledgePurchase(input: StorePurchaseVerificationInput) {
    if (!input.purchaseToken) return;
    const token = await this.accessToken();
    const packageName = this.requirePackageName();
    const url = input.kind === 'SUBSCRIPTION'
      ? `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(input.externalProductId)}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`
      : `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(input.externalProductId)}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`;
    await fetchProviderJson<Record<string, unknown>>('Google Play', url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ developerPayload: 'knowme-server-verified' })
    });
  }

  async verifyPushAuthorization(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Jeton Google Pub/Sub manquant.');
    }
    const token = authorization.slice('Bearer '.length).trim();
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Jeton Google Pub/Sub invalide.');
    }
    const header = decodeBase64UrlJson<{ kid?: string; alg?: string }>(encodedHeader);
    const payload = decodeBase64UrlJson<{
      iss?: string;
      aud?: string;
      exp?: number;
      email?: string;
      email_verified?: boolean;
    }>(encodedPayload);
    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Algorithme Google Pub/Sub invalide.');
    }
    const jwk = (await this.googleJwks()).find((entry) => entry.kid === header.kid);
    if (!jwk) throw new UnauthorizedException('Clé Google Pub/Sub inconnue.');
    const normalizedSignature = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    const signature = Buffer.from(
      normalizedSignature + '='.repeat((4 - normalizedSignature.length % 4) % 4),
      'base64'
    );
    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPublicKey({ key: jwk, format: 'jwk' }),
      signature
    );
    const expectedAudience = this.config.get<string>('GOOGLE_PUBSUB_AUDIENCE')?.trim();
    const expectedEmail = this.config
      .get<string>('GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL')
      ?.trim();
    const issuerValid = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
    if (
      !valid ||
      !issuerValid ||
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000) ||
      !expectedAudience ||
      payload.aud !== expectedAudience ||
      !expectedEmail ||
      payload.email !== expectedEmail ||
      payload.email_verified !== true
    ) {
      throw new UnauthorizedException('Jeton Google Pub/Sub non autorisé.');
    }
  }

  parseNotification(payload: Record<string, unknown>): ParsedProviderWebhook {
    const message = (payload.message ?? {}) as Record<string, unknown>;
    const encoded = String(message.data ?? '');
    if (!encoded) throw new BadRequestException('Notification Google vide.');
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Record<string, unknown>;
    const subscription = (decoded.subscriptionNotification ?? {}) as Record<string, unknown>;
    const product = (decoded.oneTimeProductNotification ?? {}) as Record<string, unknown>;
    const purchaseToken = String(subscription.purchaseToken ?? product.purchaseToken ?? '');
    const eventTime = String(decoded.eventTimeMillis ?? '0');
    const notificationType = String(
      subscription.notificationType ?? product.notificationType ?? 'TEST'
    );
    return {
      externalEventId: `google-${message.messageId ?? `${eventTime}-${notificationType}-${purchaseToken}`}`,
      externalTransactionId: purchaseToken || undefined,
      eventType: notificationType,
      raw: decoded
    };
  }

  private async verifyOneTimeProduct(
    input: StorePurchaseVerificationInput
  ): Promise<VerifiedStorePurchase> {
    const response = await fetchProviderJson<Record<string, unknown> & {
      purchaseState?: number;
      purchaseTimeMillis?: string;
      orderId?: string;
      productId?: string;
      regionCode?: string;
      obfuscatedExternalAccountId?: string;
    }>(
      'Google Play',
      `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(this.requirePackageName())}/purchases/products/${encodeURIComponent(input.externalProductId)}/tokens/${encodeURIComponent(input.purchaseToken!)}`,
      { headers: { authorization: `Bearer ${await this.accessToken()}` } }
    );
    if (response.productId && response.productId !== input.externalProductId) {
      throw new UnauthorizedException('Le produit Google Play ne correspond pas au catalogue.');
    }
    if (
      response.obfuscatedExternalAccountId &&
      response.obfuscatedExternalAccountId !== input.expectedAccountReference
    ) {
      throw new UnauthorizedException('L’achat Google Play appartient à un autre compte.');
    }
    const state = Number(response.purchaseState ?? 1);
    return {
      status: state === 0 ? 'SUCCESS' : state === 2 ? 'PENDING' : 'CANCELED',
      externalTransactionId: String(response.orderId ?? input.purchaseToken),
      externalProductId: input.externalProductId,
      accountReference: response.obfuscatedExternalAccountId,
      regionCode: response.regionCode,
      purchasedAt: new Date(Number(response.purchaseTimeMillis ?? Date.now())),
      rawStatus: String(response.purchaseState ?? 'UNKNOWN'),
      raw: response
    };
  }

  private async verifySubscription(
    input: StorePurchaseVerificationInput
  ): Promise<VerifiedStorePurchase> {
    const response = await fetchProviderJson<Record<string, unknown> & {
      subscriptionState?: string;
      latestOrderId?: string;
      startTime?: string;
      regionCode?: string;
      lineItems?: Array<{ productId?: string; expiryTime?: string }>;
      externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
      canceledStateContext?: Record<string, unknown>;
    }>(
      'Google Play',
      `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(this.requirePackageName())}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken!)}`,
      { headers: { authorization: `Bearer ${await this.accessToken()}` } }
    );
    const line = response.lineItems?.find(
      (entry) => entry.productId === input.externalProductId
    );
    if (!line) {
      throw new UnauthorizedException('L’abonnement Google Play ne correspond pas au catalogue.');
    }
    const accountReference = response.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (accountReference && accountReference !== input.expectedAccountReference) {
      throw new UnauthorizedException('L’abonnement Google Play appartient à un autre compte.');
    }
    const state = String(response.subscriptionState ?? 'UNKNOWN');
    const periodEnd = line.expiryTime ? new Date(line.expiryTime) : undefined;
    const accessUntilExpiry = Boolean(periodEnd && periodEnd > new Date());
    const active = [
      'SUBSCRIPTION_STATE_ACTIVE',
      'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    ].includes(state) || (state === 'SUBSCRIPTION_STATE_CANCELED' && accessUntilExpiry);
    const status = active
      ? 'SUCCESS'
      : state === 'SUBSCRIPTION_STATE_PENDING'
        ? 'PENDING'
        : state === 'SUBSCRIPTION_STATE_EXPIRED'
          ? 'CANCELED'
          : 'FAILED';
    return {
      status,
      externalTransactionId: String(response.latestOrderId ?? input.purchaseToken),
      externalSubscriptionId: input.purchaseToken,
      externalProductId: input.externalProductId,
      accountReference,
      regionCode: response.regionCode,
      purchasedAt: response.startTime ? new Date(response.startTime) : new Date(),
      periodStart: response.startTime ? new Date(response.startTime) : undefined,
      periodEnd,
      cancelAtPeriodEnd: state === 'SUBSCRIPTION_STATE_CANCELED',
      rawStatus: state,
      raw: response
    };
  }

  private async accessToken() {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }
    const account = this.requireServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: account.token_uri ?? 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
      },
      account.private_key,
      'RS256'
    );
    const response = await fetchProviderJson<{
      access_token?: string;
      expires_in?: number;
    }>('Google OAuth', account.token_uri ?? 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      }).toString()
    });
    if (!response.access_token) {
      throw new ServiceUnavailableException('Google OAuth n’a pas fourni de jeton.');
    }
    this.cachedToken = {
      value: response.access_token,
      expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000
    };
    return response.access_token;
  }

  private async googleJwks() {
    if (this.cachedJwks && this.cachedJwks.expiresAt > Date.now()) {
      return this.cachedJwks.keys;
    }
    const response = await fetchProviderJson<{ keys?: JsonWebKey[] }>(
      'Google Identity',
      GOOGLE_CERTS,
      {}
    );
    const keys = response.keys ?? [];
    this.cachedJwks = { keys, expiresAt: Date.now() + 30 * 60_000 };
    return keys;
  }

  private packageName() {
    return this.config.get<string>('GOOGLE_PACKAGE_NAME')?.trim();
  }

  private requirePackageName() {
    const value = this.packageName();
    if (!value) throw new ServiceUnavailableException('Google Play n’est pas configuré.');
    return value;
  }

  private serviceAccountOrNull(): ServiceAccount | null {
    const raw = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON')?.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ServiceAccount;
      return parsed.client_email && parsed.private_key ? parsed : null;
    } catch {
      return null;
    }
  }

  private requireServiceAccount() {
    const account = this.serviceAccountOrNull();
    if (!account) {
      throw new ServiceUnavailableException(
        'Le compte de service Google Play n’est pas configuré.'
      );
    }
    return account;
  }
}
