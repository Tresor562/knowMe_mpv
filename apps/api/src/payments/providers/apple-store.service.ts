import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify, X509Certificate } from 'crypto';
import { fetchProviderJson, ProviderHttpError } from '../payment-http';
import {
  decodeBase64UrlJson,
  signJwt
} from '../payment-crypto';
import {
  ParsedProviderWebhook,
  StorePurchaseVerificationInput,
  VerifiedStorePurchase
} from '../payment-provider.types';

const PRODUCTION_API = 'https://api.storekit.apple.com';
const SANDBOX_API = 'https://api.storekit-sandbox.apple.com';

type AppleTransaction = {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  appAppleId?: number;
  productId?: string;
  purchaseDate?: number;
  originalPurchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment?: string;
  type?: string;
};

type AppleNotification = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  signedDate?: number;
  data?: {
    bundleId?: string;
    appAppleId?: number;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

@Injectable()
export class AppleStoreService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(
      this.keyId() &&
      this.issuerId() &&
      this.privateKey() &&
      this.bundleId() &&
      this.trustedRoots().length
    );
  }

  async verifyPurchase(
    input: StorePurchaseVerificationInput
  ): Promise<VerifiedStorePurchase> {
    if (!input.transactionId) {
      throw new BadRequestException('Identifiant de transaction Apple manquant.');
    }
    const response = await this.getTransactionInfo(input.transactionId);
    const signed = response.signedTransactionInfo;
    if (!signed) {
      throw new ServiceUnavailableException(
        'Apple n’a pas retourné de transaction signée.'
      );
    }
    const transaction = this.verifySignedPayload<AppleTransaction>(signed);
    this.assertTransactionMatches(transaction, input);
    const periodEnd = transaction.expiresDate
      ? new Date(transaction.expiresDate)
      : undefined;
    const revoked = Boolean(transaction.revocationDate);
    const expired = Boolean(periodEnd && periodEnd <= new Date());
    return {
      status: revoked ? 'REFUNDED' : expired ? 'CANCELED' : 'SUCCESS',
      externalTransactionId: String(transaction.transactionId),
      externalSubscriptionId:
        input.kind === 'SUBSCRIPTION'
          ? String(transaction.originalTransactionId ?? transaction.transactionId)
          : undefined,
      externalProductId: String(transaction.productId),
      accountReference: transaction.appAccountToken,
      purchasedAt: new Date(
        transaction.purchaseDate ?? transaction.originalPurchaseDate ?? Date.now()
      ),
      periodStart: transaction.originalPurchaseDate
        ? new Date(transaction.originalPurchaseDate)
        : undefined,
      periodEnd,
      rawStatus: revoked ? 'REVOKED' : expired ? 'EXPIRED' : 'ACTIVE',
      raw: transaction as Record<string, unknown>
    };
  }

  parseNotification(payload: Record<string, unknown>): ParsedProviderWebhook {
    const signedPayload = String(payload.signedPayload ?? '');
    if (!signedPayload) {
      throw new BadRequestException('Notification Apple V2 vide.');
    }
    const notification = this.verifySignedPayload<AppleNotification>(signedPayload);
    if (notification.data?.bundleId !== this.requireBundleId()) {
      throw new UnauthorizedException('Le bundle de la notification Apple est invalide.');
    }
    if (notification.data?.appAppleId && this.appAppleId()) {
      if (String(notification.data.appAppleId) !== this.appAppleId()) {
        throw new UnauthorizedException('L’application Apple ne correspond pas à KnowMe.');
      }
    }
    let externalTransactionId: string | undefined;
    if (notification.data?.signedTransactionInfo) {
      const transaction = this.verifySignedPayload<AppleTransaction>(
        notification.data.signedTransactionInfo
      );
      if (transaction.bundleId !== this.requireBundleId()) {
        throw new UnauthorizedException('La transaction Apple notifiée est invalide.');
      }
      externalTransactionId = transaction.transactionId;
    }
    return {
      externalEventId: String(notification.notificationUUID ?? ''),
      externalTransactionId,
      eventType: String(notification.notificationType ?? 'UNKNOWN'),
      raw: notification as Record<string, unknown>
    };
  }

  verifySignedPayload<T>(signedPayload: string): T {
    const [encodedHeader, encodedPayload, encodedSignature] = signedPayload.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('JWS Apple invalide.');
    }
    const header = decodeBase64UrlJson<{
      alg?: string;
      x5c?: string[];
    }>(encodedHeader);
    if (header.alg !== 'ES256' || !header.x5c?.length) {
      throw new UnauthorizedException('En-tête JWS Apple invalide.');
    }
    const certificates = header.x5c.map(
      (value) => new X509Certificate(Buffer.from(value, 'base64'))
    );
    this.verifyCertificateChain(certificates);
    const normalized = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    const signature = Buffer.from(
      normalized + '='.repeat((4 - normalized.length % 4) % 4),
      'base64'
    );
    const valid = verify(
      'sha256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      {
        key: certificates[0]!.publicKey,
        dsaEncoding: 'ieee-p1363'
      },
      signature
    );
    if (!valid) throw new UnauthorizedException('Signature JWS Apple invalide.');
    return decodeBase64UrlJson<T>(encodedPayload);
  }

  private async getTransactionInfo(transactionId: string) {
    const path = `/inApps/v1/transactions/${encodeURIComponent(transactionId)}`;
    try {
      return await this.requestTransaction(PRODUCTION_API + path);
    } catch (error) {
      if (
        error instanceof ProviderHttpError &&
        error.status === 404 &&
        this.isTransactionNotFound(error.responseBody)
      ) {
        return this.requestTransaction(SANDBOX_API + path);
      }
      throw error;
    }
  }

  private requestTransaction(url: string) {
    return fetchProviderJson<{ signedTransactionInfo?: string }>('Apple App Store', url, {
      headers: { authorization: `Bearer ${this.apiJwt()}` }
    });
  }

  private apiJwt() {
    const now = Math.floor(Date.now() / 1000);
    return signJwt(
      {
        alg: 'ES256',
        kid: this.requireKeyId(),
        typ: 'JWT'
      },
      {
        iss: this.requireIssuerId(),
        iat: now,
        exp: now + 15 * 60,
        aud: 'appstoreconnect-v1',
        bid: this.requireBundleId()
      },
      this.requirePrivateKey(),
      'ES256'
    );
  }

  private assertTransactionMatches(
    transaction: AppleTransaction,
    input: StorePurchaseVerificationInput
  ) {
    if (!transaction.transactionId || !transaction.productId) {
      throw new UnauthorizedException('Transaction Apple incomplète.');
    }
    if (transaction.bundleId !== this.requireBundleId()) {
      throw new UnauthorizedException('La transaction Apple vise un autre bundle.');
    }
    if (this.appAppleId() && String(transaction.appAppleId ?? '') !== this.appAppleId()) {
      throw new UnauthorizedException('La transaction Apple vise une autre application.');
    }
    if (transaction.productId !== input.externalProductId) {
      throw new UnauthorizedException('Le produit Apple ne correspond pas au catalogue.');
    }
    if (
      transaction.appAccountToken &&
      transaction.appAccountToken !== input.expectedAccountReference
    ) {
      throw new UnauthorizedException('La transaction Apple appartient à un autre compte.');
    }
    if (!transaction.appAccountToken) {
      throw new UnauthorizedException(
        'La transaction Apple ne contient pas de liaison de compte KnowMe.'
      );
    }
  }

  private verifyCertificateChain(certificates: X509Certificate[]) {
    const now = Date.now();
    for (const certificate of certificates) {
      const validFrom = new Date(certificate.validFrom).getTime();
      const validTo = new Date(certificate.validTo).getTime();
      if (now < validFrom || now > validTo) {
        throw new UnauthorizedException('Certificat Apple expiré ou non valide.');
      }
    }
    for (let index = 0; index < certificates.length - 1; index += 1) {
      if (!certificates[index]!.verify(certificates[index + 1]!.publicKey)) {
        throw new UnauthorizedException('Chaîne de certificats Apple invalide.');
      }
    }
    const last = certificates[certificates.length - 1]!;
    const trusted = this.trustedRoots().some((root) => {
      const sameFingerprint = root.fingerprint256 === last.fingerprint256;
      return sameFingerprint || last.verify(root.publicKey);
    });
    if (!trusted) {
      throw new UnauthorizedException('Racine de confiance Apple inconnue.');
    }
  }

  private trustedRoots() {
    const raw = this.config.get<string>('APPLE_ROOT_CA_PEMS_JSON')?.trim();
    if (!raw) return [];
    try {
      const values = JSON.parse(raw) as string[];
      if (!Array.isArray(values)) return [];
      return values.map(
        (value) => new X509Certificate(value.replace(/\\n/g, '\n'))
      );
    } catch {
      return [];
    }
  }

  private isTransactionNotFound(body: unknown) {
    if (!body || typeof body !== 'object') return true;
    const errorCode = (body as Record<string, unknown>).errorCode;
    return errorCode === 4040010 || errorCode === '4040010';
  }

  private keyId() {
    return this.config.get<string>('APPLE_KEY_ID')?.trim();
  }

  private issuerId() {
    return this.config.get<string>('APPLE_ISSUER_ID')?.trim();
  }

  private privateKey() {
    return this.config.get<string>('APPLE_PRIVATE_KEY')?.trim();
  }

  private bundleId() {
    return this.config.get<string>('APPLE_BUNDLE_ID')?.trim();
  }

  private appAppleId() {
    return this.config.get<string>('APPLE_APP_ID')?.trim();
  }

  private requireKeyId() {
    const value = this.keyId();
    if (!value) throw new ServiceUnavailableException('Apple n’est pas configuré.');
    return value;
  }

  private requireIssuerId() {
    const value = this.issuerId();
    if (!value) throw new ServiceUnavailableException('Apple n’est pas configuré.');
    return value;
  }

  private requirePrivateKey() {
    const value = this.privateKey();
    if (!value) throw new ServiceUnavailableException('Apple n’est pas configuré.');
    return value;
  }

  private requireBundleId() {
    const value = this.bundleId();
    if (!value) throw new ServiceUnavailableException('Apple n’est pas configuré.');
    return value;
  }
}
