import {
  Injectable,
  ServiceUnavailableException,
  TooManyRequestsException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityContext } from '../security/security.service';
import { sendGmailRecoveryMail } from './gmail-smtp';

type RecoveryPayload = {
  v: 1;
  aud: string;
  sub: string;
  exp: number;
  nonce: string;
  pwd: string;
};

const RECOVERY_BUDGET_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_EMAIL_BUDGET = 3;
const RECOVERY_IP_BUDGET = 12;

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
    const transport = this.config.get<string>('ACCOUNT_RECOVERY_TRANSPORT') ?? 'HTTPS_API';
    const gmailUser = this.config.get<string>('ACCOUNT_RECOVERY_GMAIL_USER');
    const gmailAppPassword = this.config.get<string>('ACCOUNT_RECOVERY_GMAIL_APP_PASSWORD');
    const isGmail = transport === 'GMAIL_SMTP';

    if (
      !secret || secret.length < 32 || !from || !webUrl ||
      (isGmail ? !gmailUser || !gmailAppPassword : !endpoint || !apiKey)
    ) {
      throw new ServiceUnavailableException('La récupération de compte est temporairement indisponible.');
    }

    const audience = this.recoveryAudience(webUrl);
    const email = emailInput.trim().toLowerCase();
    await this.consumeRecoveryRequestBudget(email, secret, context);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.isSuspended) {
      return { accepted: true };
    }

    const payload: RecoveryPayload = {
      v: 1,
      aud: audience,
      sub: user.id,
      exp: Date.now() + 15 * 60 * 1000,
      nonce: randomBytes(24).toString('base64url'),
      pwd: this.passwordFingerprint(user.passwordHash)
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.sign(encoded, secret);
    const token = `${encoded}.${signature}`;
    const resetUrl = `${audience}/reset-password#token=${encodeURIComponent(token)}`;

    const subject = 'Réinitialise ton mot de passe KnowMe';
    const html = `<div style="font-family:Arial,sans-serif;background:#f7f8fe;padding:32px 16px">
      <div style="max-width:520px;margin:auto;background:#fff;border-radius:20px;padding:30px">
        <p style="font-size:20px;font-weight:bold;color:#1b2543">KnowMe</p>
        <h1 style="font-size:24px;color:#1b2543">Réinitialise ton mot de passe</h1>
        <p style="color:#515b70;line-height:1.6">Une demande de réinitialisation a été reçue pour ton compte KnowMe.</p>
        <p style="padding:18px 0"><a href="${this.escapeHtml(resetUrl)}" style="background:#485fd2;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:bold">Choisir un nouveau mot de passe</a></p>
        <p style="color:#515b70;font-size:13px;line-height:1.6">Ce lien expire dans 15 minutes. Si tu n'as pas demandé ce changement, ignore ce message.</p>
      </div>
    </div>`;

    try {
      if (isGmail) {
        await sendGmailRecoveryMail({
          username: gmailUser!,
          appPassword: gmailAppPassword!,
          from,
          to: user.email,
          subject,
          html
        });
      } else {
        const response = await fetch(endpoint!, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ from, to: [user.email], subject, html }),
          signal: AbortSignal.timeout(8_000)
        });
        if (!response.ok) {
          await this.writeAudit('ACCOUNT_RECOVERY_DELIVERY_FAILED', user.id, context, {
            providerStatus: response.status
          });
          return { accepted: true };
        }
      }
    } catch {
      await this.writeAudit('ACCOUNT_RECOVERY_DELIVERY_FAILED', user.id, context, {
        providerStatus: 'TRANSPORT_ERROR'
      });
      return { accepted: true };
    }

    await this.writeAudit('ACCOUNT_RECOVERY_REQUESTED', user.id, context);
    return { accepted: true };
  }

  async reset(token: string, nextPassword: string, context: SecurityContext = {}) {
    const secret = this.config.get<string>('ACCOUNT_RECOVERY_SECRET');
    const webUrl = this.config.get<string>('WEB_URL');
    if (!secret || secret.length < 32 || !webUrl) {
      throw new ServiceUnavailableException('La récupération de compte est temporairement indisponible.');
    }

    const payload = this.verify(token, secret, this.recoveryAudience(webUrl));
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
    const consumed = await this.prisma.$transaction(async (tx) => {
      const passwordUpdate = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordHash: user.passwordHash
        },
        data: { passwordHash }
      });

      if (passwordUpdate.count !== 1) return false;

      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.trustedDevice.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now }
      });
      return true;
    });

    if (!consumed) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    await this.writeAudit('ACCOUNT_PASSWORD_RESET', user.id, context, {
      sessionsRevoked: true,
      trustedDevicesRevoked: true
    });
    return { reset: true };
  }

  private async consumeRecoveryRequestBudget(email: string, secret: string, context: SecurityContext) {
    const targetFingerprint = createHmac('sha256', secret)
      .update(`account-recovery:${email}`)
      .digest('base64url');
    const lockKeys = [this.advisoryLockKey(`email:${targetFingerprint}`)];
    if (context.ipAddress) lockKeys.push(this.advisoryLockKey(`ip:${context.ipAddress}`));
    const orderedLockKeys = [...new Set(lockKeys)].sort((a, b) => a - b);
    const since = new Date(Date.now() - RECOVERY_BUDGET_WINDOW_MS);

    const counts = await this.prisma.$transaction(async (tx) => {
      for (const lockKey of orderedLockKeys) {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      }

      await tx.auditLog.create({
        data: {
          action: 'ACCOUNT_RECOVERY_ATTEMPT',
          entity: 'ACCOUNT_RECOVERY',
          entityId: targetFingerprint,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      });

      const emailCount = await tx.auditLog.count({
        where: {
          action: 'ACCOUNT_RECOVERY_ATTEMPT',
          entity: 'ACCOUNT_RECOVERY',
          entityId: targetFingerprint,
          createdAt: { gte: since }
        }
      });
      const ipCount = context.ipAddress
        ? await tx.auditLog.count({
          where: {
            action: 'ACCOUNT_RECOVERY_ATTEMPT',
            entity: 'ACCOUNT_RECOVERY',
            ipAddress: context.ipAddress,
            createdAt: { gte: since }
          }
        })
        : 0;

      return { emailCount, ipCount };
    });

    if (counts.emailCount > RECOVERY_EMAIL_BUDGET || counts.ipCount > RECOVERY_IP_BUDGET) {
      throw new TooManyRequestsException('Trop de demandes de récupération. Réessaie plus tard.');
    }
  }

  private advisoryLockKey(value: string) {
    return createHash('sha256').update(value).digest().readInt32BE(0);
  }

  private verify(token: string, secret: string, expectedAudience: string): RecoveryPayload {
    const segments = token.split('.');
    if (segments.length !== 2) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    const [encoded, suppliedSignature] = segments;
    if (!encoded || !suppliedSignature) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    const expected = Buffer.from(this.sign(encoded, secret));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
      if (!this.isRecoveryPayload(parsed, expectedAudience)) throw new Error('invalid');
      return parsed;
    } catch {
      throw new UnauthorizedException('Lien de récupération invalide ou expiré.');
    }
  }

  private isRecoveryPayload(value: unknown, expectedAudience: string): value is RecoveryPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

    const payload = value as Record<string, unknown>;
    const keys = Object.keys(payload).sort();
    if (keys.join(',') !== 'aud,exp,nonce,pwd,sub,v') return false;

    return (
      payload.v === 1 &&
      typeof payload.aud === 'string' &&
      payload.aud === expectedAudience &&
      payload.aud.length <= 2048 &&
      typeof payload.sub === 'string' &&
      payload.sub.length > 0 &&
      payload.sub.length <= 128 &&
      typeof payload.exp === 'number' &&
      Number.isSafeInteger(payload.exp) &&
      payload.exp > 0 &&
      typeof payload.nonce === 'string' &&
      payload.nonce.length >= 32 &&
      payload.nonce.length <= 128 &&
      typeof payload.pwd === 'string' &&
      payload.pwd.length >= 32 &&
      payload.pwd.length <= 128
    );
  }

  private recoveryAudience(webUrl: string) {
    return webUrl.replace(/\/$/, '');
  }

  private sign(value: string, secret: string) {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private passwordFingerprint(passwordHash: string) {
    return createHash('sha256').update(passwordHash).digest('base64url');
  }

  private async writeAudit(action: string, userId: string, context: SecurityContext, metadata?: Prisma.InputJsonValue) {
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
