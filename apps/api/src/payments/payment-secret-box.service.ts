import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from 'crypto';

@Injectable()
export class PaymentSecretBoxService {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.keyOrNull());
  }

  encrypt(value: string, context: string) {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return ['v1', iv, tag, encrypted]
      .map((entry) =>
        typeof entry === 'string'
          ? entry
          : entry.toString('base64url')
      )
      .join('.');
  }

  decrypt(value: string, context: string) {
    const [version, ivValue, tagValue, encryptedValue] = value.split('.');
    if (
      version !== 'v1' ||
      !ivValue ||
      !tagValue ||
      !encryptedValue
    ) {
      throw new UnauthorizedException('Donnée de paiement chiffrée invalide.');
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.requireKey(),
        Buffer.from(ivValue, 'base64url')
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final()
      ]).toString('utf8');
    } catch {
      throw new UnauthorizedException(
        'Impossible de déchiffrer la donnée de paiement.'
      );
    }
  }

  private keyOrNull() {
    const raw = this.config
      .get<string>('PAYMENTS_DATA_ENCRYPTION_KEY')
      ?.trim();
    if (!raw) return null;
    try {
      const key = Buffer.from(raw, 'base64');
      return key.length === 32 ? key : null;
    } catch {
      return null;
    }
  }

  private requireKey() {
    const key = this.keyOrNull();
    if (!key) {
      throw new ServiceUnavailableException(
        'PAYMENTS_DATA_ENCRYPTION_KEY doit contenir 32 octets encodés en base64.'
      );
    }
    return key;
  }
}
