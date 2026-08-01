import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

@Injectable()
export class SecurityCryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    this.key = this.resolveKey();
  }

  generateTotpSecret() {
    return this.encodeBase32(randomBytes(20));
  }

  encrypt(secret: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final()
    ]);
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64')
    };
  }

  decrypt(input: EncryptedSecret) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(input.iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(input.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(input.ciphertext, 'base64')),
        decipher.final()
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Le secret de sécurité ne peut pas être déchiffré.'
      );
    }
  }

  verifyTotp(secret: string, code: string, now = Date.now()) {
    if (!/^\d{6}$/.test(code)) return null;
    const currentStep = Math.floor(now / 1000 / 30);

    for (const offset of [-1, 0, 1]) {
      const step = currentStep + offset;
      const expected = this.totpAtStep(secret, step);
      if (this.safeEqual(expected, code)) return step;
    }

    return null;
  }

  buildOtpAuthUri(input: {
    secret: string;
    email: string;
    issuer?: string;
  }) {
    const issuer = input.issuer ?? 'KnowMe';
    const label = `${issuer}:${input.email}`;
    const query = new URLSearchParams({
      secret: input.secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30'
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
  }

  hashToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  hashContext(value?: string) {
    if (!value) return null;
    return createHash('sha256').update(value).digest('hex');
  }

  private totpAtStep(secret: string, step: number) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const digest = createHmac('sha1', this.decodeBase32(secret))
      .update(counter)
      .digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  private encodeBase32(buffer: Buffer) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  private decodeBase32(value: string) {
    const normalized = value.toUpperCase().replace(/=+$/g, '');
    let bits = 0;
    let accumulator = 0;
    const output: number[] = [];

    for (const character of normalized) {
      const index = BASE32_ALPHABET.indexOf(character);
      if (index < 0) throw new Error('Invalid base32 secret.');
      accumulator = (accumulator << 5) | index;
      bits += 5;
      if (bits >= 8) {
        output.push((accumulator >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  private safeEqual(expected: string, received: string) {
    const left = Buffer.from(expected);
    const right = Buffer.from(received);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private resolveKey() {
    const configured = this.config.get<string>('ACCOUNT_SECURITY_ENCRYPTION_KEY');
    if (configured) {
      const hex = /^[a-f0-9]{64}$/i.test(configured)
        ? Buffer.from(configured, 'hex')
        : Buffer.from(configured, 'base64');
      if (hex.length === 32) return hex;
      throw new InternalServerErrorException(
        'ACCOUNT_SECURITY_ENCRYPTION_KEY doit contenir exactement 32 octets.'
      );
    }

    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new InternalServerErrorException(
        'ACCOUNT_SECURITY_ENCRYPTION_KEY est obligatoire en production.'
      );
    }

    const jwtSecret = this.config.get<string>('JWT_SECRET') ?? 'knowme-local-security';
    return createHash('sha256')
      .update(`${jwtSecret}:account-security-development-key`)
      .digest();
  }
}
