import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityContext } from '../security/security.service';

type RecoveryPayload = {
  sub: string;
  exp: number;
  nonce: string;
  pwd: string;
};

@Injectable()
export class AccountRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async request(emailInput: string, context: SecurityContext = {}) {
    const secret = this.config.get<string>('ACCOUNT_RECOVERY_SECRET');
    const endpoint = this.config.get<string>('ACCOUNT_RECOVERY_EMAIL_ENDPOINT');
    const apiKey = this.config.get<string>('ACCOUNT_RECOVERY_EMAIL_API_KEY');
    const from = this.config.get<string>('ACCOUNT_RECOVERY_EMAIL_FROM');
    const webUrl = this.config.get<string>('WEB_URL');

    // Configuration availability is account-independent, so a failure cannot
    // be used to infer whether a submitted address exists.
    if (!secret || secret.length < 32 || !endpoint || !apiKey || !from || !webUrl) {
      throw new ServiceUnavailableException('La récupération de compte est temporairement indisponible.');
    }

    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return the same public result to prevent account enumeration.
    if (!user || user.isSuspended) {
      return { accepted: true };
    }

    const payload: RecoveryPayload = {
      sub: user.id,
      exp: Date.now() + 15 * 60 * 1000,
      nonce: randomBytes(24).toString('base64url'),
      pwd: this.passwordFingerprint(user.passwordHash)
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.sign(encoded, secret);
    const token = `${encoded}.${signature}`;
    const resetUrl = `${webUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: 'Réinitialise ton mot de passe KnowMe',
          html: `<p>Une réinitialisation de mot de passe a été demandée pour ton compte KnowMe.</p><p><a href="${this.escapeHtml(resetUrl)}">Réinitialiser mon mot de passe</a></p><p>Ce lien expire dans 15 minutes. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.</p>`
        })
      });

      if (!response.ok) {
        await this.writeAudit('ACCOUNT_RECOVERY_DELIVERY_FAILED', user.id, context, {
          providerStatus: response.status
        });
        return { accepted: true };
      }
    } catch {
      await this.writeAudit('ACCOUNT_RECOVERY_DELIVERY_FAILED', user.id, context, {
        providerStatus: 'NETWORK_ERROR'
      });
      return { accepted: true };
    }

    await this.writeAudit('ACCOUNT_RECOVERY_REQUESTED', user.id, context);
    return { accepted: true };
  }

  async reset(token: string, nextPassword: string, context: SecurityContext = {}) {
    const secret = this.config.get<string>('ACCOUNT_RECOVERY_SECRET');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('La récupération de compte est temporairement indisponible.');
    }

    const payload = this.verify(token, secret);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (
      !user ||
      user.isSuspended ||
      payload.exp <= Date.now() ||
      payload.pwd !== this.passwordFingerprint(user.passwordHash)
    ) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    const now = new Date();
    const passwordHash = await argon2.hash(nextPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now }
      }),
      this.prisma.trustedDevice.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now }
      })
    ]);

    await this.writeAudit('ACCOUNT_PASSWORD_RESET', user.id, context, {
      sessionsRevoked: true,
      trustedDevicesRevoked: true
    });
    return { reset: true };
  }

  private verify(token: string, secret: string): RecoveryPayload {
    const [encoded, suppliedSignature] = token.split('.');
    if (!encoded || !suppliedSignature) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    const expected = Buffer.from(this.sign(encoded, secret));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as RecoveryPayload;
      if (!payload.sub || !payload.exp || !payload.nonce || !payload.pwd) throw new Error('invalid');
      return payload;
    } catch {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }
  }

  private sign(value: string, secret: string) {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private passwordFingerprint(passwordHash: string) {
    return createHash('sha256').update(passwordHash).digest('base64url');
  }

  private async writeAudit(action: string, userId: string, context: SecurityContext, metadata?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entity: 'ACCOUNT',
        entityId: userId,
        targetAccountId: userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata
      }
    }).catch(() => undefined);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
