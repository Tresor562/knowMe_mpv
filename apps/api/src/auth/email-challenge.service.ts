import { ConflictException, Injectable, ServiceUnavailableException, TooManyRequestsException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { SecurityContext } from '../security/security.service';
import { TransactionalEmailService } from './transactional-email.service';

type Purpose = 'SIGNUP' | 'RECOVERY' | 'EMAIL_CHANGE';
const EXPIRES_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailChallengeService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly mail: TransactionalEmailService) {}
  assertReady() {
    this.secret();
    this.mail.assertReady();
  }
  private secret() {
    const value = this.config.get<string>('EMAIL_OTP_SECRET');
    if (!value || value.length < 32) throw new ServiceUnavailableException('La confirmation email est temporairement indisponible.');
    return value;
  }
  private normalize(input: string) { return input.trim().toLowerCase(); }
  private hash(userId: string, purpose: Purpose, email: string, code: string) {
    return createHmac('sha256', this.secret()).update([userId, purpose, email, code].join(':')).digest('hex');
  }
  private async audit(action: string, userId: string, context: SecurityContext = {}) {
    await this.prisma.auditLog.create({
      data: { action, entity: 'ACCOUNT', entityId: userId, targetAccountId: userId, ipAddress: context.ipAddress, userAgent: context.userAgent }
    }).catch(() => undefined);
  }
  private async send(userId: string, purpose: Purpose, email: string, context: SecurityContext = {}) {
    this.assertReady();
    const now = new Date();
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const entry = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.emailChallenge.findFirst({ where: { userId, purpose }, orderBy: { createdAt: 'desc' } });
      if (latest && latest.createdAt.getTime() > Date.now() - COOLDOWN_MS) {
        throw new TooManyRequestsException('Un code a déjà été envoyé. Patientez une minute.');
      }
      await tx.emailChallenge.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: now } });
      return tx.emailChallenge.create({
        data: { userId, purpose, targetEmail: email, codeHash: this.hash(userId, purpose, email, code), expiresAt: new Date(now.getTime() + EXPIRES_MS) }
      });
    });
    const subject = purpose === 'SIGNUP' ? 'Confirmez votre adresse email KnowMe'
      : purpose === 'RECOVERY' ? 'Code de récupération de compte KnowMe'
      : 'Confirmez votre nouvelle adresse email KnowMe';
    const body = 'Votre code de sécurité KnowMe expire dans 10 minutes. Il est utilisable une seule fois. Ne le partagez avec personne.';
    try {
      await this.mail.send(email, subject, body, code);
    } catch (error) {
      await this.prisma.emailChallenge.updateMany({ where: { id: entry.id, consumedAt: null }, data: { consumedAt: new Date() } });
      throw error;
    }
    await this.audit('EMAIL_CODE_SENT_' + purpose, userId, context);
    return { accepted: true, expiresIn: 600 };
  }
  // Invalid attempts must return false so the transaction can persist the increment.
  private async consume(tx: Prisma.TransactionClient, userId: string, purpose: Purpose, email: string, code: string) {
    const row = await tx.emailChallenge.findFirst({
      where: { userId, purpose, targetEmail: email, consumedAt: null }, orderBy: { createdAt: 'desc' }
    });
    if (!row || row.expiresAt <= new Date() || row.attempts >= MAX_ATTEMPTS) return false;
    const attempt = await tx.emailChallenge.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } }
    });
    if (attempt.count !== 1) return false;
    const actual = Buffer.from(this.hash(userId, purpose, email, code), 'hex');
    const expected = Buffer.from(row.codeHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const consumed = await tx.emailChallenge.updateMany({
      where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() }
    });
    return consumed.count === 1;
  }

  async resendSignup(input: string, context: SecurityContext = {}) {
    const email = this.normalize(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isSuspended || user.emailVerifiedAt) return { accepted: true };
    return this.send(user.id, 'SIGNUP', email, context);
  }

  async confirmSignup(input: string, code: string, context: SecurityContext = {}) {
    const email = this.normalize(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isSuspended || user.emailVerifiedAt) throw new UnauthorizedException('Code invalide ou expiré.');
    const accepted = await this.prisma.$transaction(async (tx) => {
      if (!await this.consume(tx, user.id, 'SIGNUP', email, code)) return false;
      const updated = await tx.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
      return updated.count === 1;
    });
    if (!accepted) throw new UnauthorizedException('Code invalide ou expiré.');
    await this.audit('EMAIL_CONFIRMED', user.id, context);
    return user.id;
  }

  async requestRecovery(input: string, context: SecurityContext = {}) {
    const email = this.normalize(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isSuspended) return { accepted: true };
    await this.send(user.id, 'RECOVERY', email, context);
    return { accepted: true };
  }

  async resetPassword(input: string, code: string, password: string, context: SecurityContext = {}) {
    const email = this.normalize(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isSuspended) throw new UnauthorizedException('Code invalide ou expiré.');
    const hash = await argon2.hash(password);
    const result = await this.prisma.$transaction(async (tx) => {
      if (!await this.consume(tx, user.id, 'RECOVERY', email, code)) return false;
      const now = new Date();
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
      await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.trustedDevice.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.emailChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
      return true;
    });
    if (!result) throw new UnauthorizedException('Code invalide ou expiré.');
    await this.audit('PASSWORD_RESET_BY_EMAIL_CODE', user.id, context);
    await this.notice(email, 'Mot de passe KnowMe modifié', 'Votre mot de passe a été modifié et vos anciennes sessions ont été fermées.');
    return { reset: true };
  }

  async requestChange(userId: string, requestedEmail: string, password: string, context: SecurityContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isSuspended || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }
    const target = this.normalize(requestedEmail);
    if (target === user.email || await this.prisma.user.findUnique({ where: { email: target } })) {
      throw new ConflictException('Adresse email indisponible.');
    }
    const result = await this.send(user.id, 'EMAIL_CHANGE', target, context);
    await this.notice(user.email, 'Changement d’adresse demandé', 'Une demande de changement de votre adresse email KnowMe a été enregistrée.');
    return result;
  }

  async confirmChange(userId: string, code: string, context: SecurityContext = {}) {
    let oldEmail = ''; let newEmail = '';
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.isSuspended) return false;
      const row = await tx.emailChallenge.findFirst({
        where: { userId, purpose: 'EMAIL_CHANGE', consumedAt: null }, orderBy: { createdAt: 'desc' }
      });
      if (!row || !await this.consume(tx, userId, 'EMAIL_CHANGE', row.targetEmail, code)) return false;
      oldEmail = user.email; newEmail = row.targetEmail;
      await tx.user.update({ where: { id: userId }, data: { email: newEmail, emailVerifiedAt: new Date() } });
      await tx.emailChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } });
      return true;
    }).catch((error: unknown) => {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Adresse email indisponible.');
      throw error;
    });
    if (!result) throw new UnauthorizedException('Code invalide ou expiré.');
    await this.audit('ACCOUNT_EMAIL_CHANGED', userId, context);
    await this.notice(oldEmail, 'Votre adresse email KnowMe a changé', 'Votre adresse email de connexion a été modifiée. Si ce n’était pas vous, contactez le support.');
    await this.notice(newEmail, 'Nouvelle adresse email confirmée', 'Cette adresse est maintenant associée à votre compte KnowMe.');
    return { changed: true, email: newEmail };
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    if (!user) throw new UnauthorizedException();
    return { email: user.email, verified: Boolean(user.emailVerifiedAt), verifiedAt: user.emailVerifiedAt };
  }

  async notice(to: string, subject: string, body: string) {
    await this.mail.send(to, subject, body).catch(() => undefined);
  }
}
