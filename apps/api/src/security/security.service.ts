import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangePasswordDto,
  DisableTwoFactorDto,
  ReauthenticateDto,
  RegenerateRecoveryCodesDto
} from './dto/security.dto';
import { SecurityCryptoService } from './security-crypto.service';

export type SecurityContext = {
  userAgent?: string;
  ipAddress?: string;
};

type SecondFactorResult = {
  method: 'TOTP' | 'RECOVERY_CODE';
  step?: number;
};

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecurityCryptoService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async status(userId: string, currentSessionId?: string) {
    const now = new Date();
    const [security, recoveryCodes, devices, sessions, events] = await Promise.all([
      this.prisma.accountSecurity.findUnique({ where: { userId } }),
      this.prisma.securityRecoveryCode.count({
        where: { userId, usedAt: null }
      }),
      this.prisma.trustedDevice.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        take: 50
      }),
      this.prisma.authSession.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true
        },
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.securityEvent.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50
      })
    ]);

    return {
      twoFactorEnabled: security?.twoFactorEnabled ?? false,
      twoFactorConfirmedAt: security?.totpConfirmedAt ?? null,
      recoveryCodesRemaining: recoveryCodes,
      lockedUntil:
        security?.lockedUntil && security.lockedUntil > now
          ? security.lockedUntil
          : null,
      sessions: sessions.map((session) => ({
        ...session,
        current: session.id === currentSessionId
      })),
      trustedDevices: devices.map((device) => ({
        id: device.id,
        label: device.label,
        platform: device.platform,
        firstSeenAt: device.firstSeenAt,
        lastSeenAt: device.lastSeenAt,
        trustedUntil: device.trustedUntil,
        active: !device.revokedAt && device.trustedUntil > now,
        revokedAt: device.revokedAt
      })),
      events
    };
  }

  async beginTwoFactorSetup(userId: string, password: string) {
    const user = await this.verifyPassword(userId, password);
    const existing = await this.prisma.accountSecurity.findUnique({
      where: { userId }
    });
    if (existing?.twoFactorEnabled) {
      throw new ConflictException('L’authentification à deux facteurs est déjà active.');
    }

    const secret = this.crypto.generateTotpSecret();
    const encrypted = this.crypto.encrypt(secret);

    await this.prisma.$transaction([
      this.prisma.accountSecurity.upsert({
        where: { userId },
        create: {
          userId,
          totpCiphertext: encrypted.ciphertext,
          totpIv: encrypted.iv,
          totpTag: encrypted.tag
        },
        update: {
          twoFactorEnabled: false,
          totpCiphertext: encrypted.ciphertext,
          totpIv: encrypted.iv,
          totpTag: encrypted.tag,
          totpConfirmedAt: null,
          lastTotpStep: null,
          failedTwoFactorAttempts: 0,
          lockedUntil: null
        }
      }),
      this.prisma.securityRecoveryCode.deleteMany({ where: { userId } })
    ]);

    await this.recordEvent(userId, 'TWO_FACTOR_SETUP_STARTED', 'INFO');

    return {
      secret,
      otpauthUri: this.crypto.buildOtpAuthUri({
        secret,
        email: user.email
      }),
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    };
  }

  async confirmTwoFactor(userId: string, code: string) {
    const security = await this.requiredSecurity(userId, false);
    const secret = this.decryptSecret(security);
    const step = this.crypto.verifyTotp(secret, code);
    if (step === null) throw new UnauthorizedException('Code de vérification invalide.');

    const rawCodes = this.generateRecoveryCodes();
    const hashes = await Promise.all(rawCodes.map((value) => argon2.hash(value)));

    const updated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.accountSecurity.updateMany({
        where: {
          userId,
          twoFactorEnabled: false,
          OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: step } }]
        },
        data: {
          twoFactorEnabled: true,
          totpConfirmedAt: new Date(),
          lastTotpStep: step,
          failedTwoFactorAttempts: 0,
          lockedUntil: null
        }
      });
      if (!consumed.count) {
        throw new ConflictException('Ce code a déjà été utilisé ou la configuration a changé.');
      }

      await tx.securityRecoveryCode.deleteMany({ where: { userId } });
      await tx.securityRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash }))
      });
      return tx.accountSecurity.findUniqueOrThrow({ where: { userId } });
    });

    await this.recordEvent(userId, 'TWO_FACTOR_ENABLED', 'HIGH', undefined, undefined, true);
    await this.audit.record({
      actorId: userId,
      action: 'TWO_FACTOR_ENABLE',
      entity: 'AccountSecurity',
      entityId: userId,
      targetAccountId: userId
    });

    return {
      enabled: updated.twoFactorEnabled,
      recoveryCodes: rawCodes
    };
  }

  async disableTwoFactor(
    userId: string,
    sessionId: string | undefined,
    dto: DisableTwoFactorDto
  ) {
    await this.verifyPassword(userId, dto.password);
    await this.verifySecondFactor(userId, dto.code);

    await this.prisma.$transaction(async (tx) => {
      await tx.accountSecurity.update({
        where: { userId },
        data: {
          twoFactorEnabled: false,
          totpCiphertext: null,
          totpIv: null,
          totpTag: null,
          totpConfirmedAt: null,
          lastTotpStep: null,
          failedTwoFactorAttempts: 0,
          lockedUntil: null
        }
      });
      await tx.securityRecoveryCode.deleteMany({ where: { userId } });
      await tx.trustedDevice.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedBySessionId: sessionId ?? null }
      });
      await tx.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(sessionId ? { id: { not: sessionId } } : {})
        },
        data: { revokedAt: new Date() }
      });
    });

    await this.recordEvent(userId, 'TWO_FACTOR_DISABLED', 'HIGH', sessionId, undefined, true);
    await this.audit.record({
      actorId: userId,
      action: 'TWO_FACTOR_DISABLE',
      entity: 'AccountSecurity',
      entityId: userId,
      targetAccountId: userId
    });
    return { disabled: true };
  }

  async regenerateRecoveryCodes(
    userId: string,
    dto: RegenerateRecoveryCodesDto
  ) {
    await this.verifyPassword(userId, dto.password);
    await this.verifySecondFactor(userId, dto.code);

    const rawCodes = this.generateRecoveryCodes();
    const hashes = await Promise.all(rawCodes.map((value) => argon2.hash(value)));
    await this.prisma.$transaction(async (tx) => {
      await tx.securityRecoveryCode.deleteMany({ where: { userId } });
      await tx.securityRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash }))
      });
    });

    await this.recordEvent(userId, 'RECOVERY_CODES_REGENERATED', 'HIGH');
    await this.audit.record({
      actorId: userId,
      action: 'RECOVERY_CODES_REGENERATE',
      entity: 'AccountSecurity',
      entityId: userId,
      targetAccountId: userId
    });
    return { recoveryCodes: rawCodes };
  }

  async beginLogin(
    userId: string,
    deviceToken: string | undefined,
    context: SecurityContext
  ) {
    const security = await this.prisma.accountSecurity.findUnique({
      where: { userId }
    });
    if (!security?.twoFactorEnabled) {
      return { required: false as const, assurance: 'PASSWORD' as const };
    }
    this.assertNotLocked(security.lockedUntil);

    if (deviceToken) {
      const trusted = await this.prisma.trustedDevice.findUnique({
        where: { deviceTokenHash: this.crypto.hashToken(deviceToken) }
      });
      if (
        trusted &&
        trusted.userId === userId &&
        !trusted.revokedAt &&
        trusted.trustedUntil > new Date()
      ) {
        await this.prisma.trustedDevice.update({
          where: { id: trusted.id },
          data: { lastSeenAt: new Date() }
        });
        await this.recordEvent(
          userId,
          'TRUSTED_DEVICE_LOGIN',
          'INFO',
          undefined,
          trusted.id,
          false,
          context
        );
        return {
          required: false as const,
          assurance: 'TRUSTED_DEVICE' as const,
          trustedDeviceId: trusted.id
        };
      }
    }

    const challengeToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.securityChallenge.create({
      data: {
        userId,
        purpose: 'LOGIN_2FA',
        tokenHash: this.crypto.hashToken(challengeToken),
        expiresAt,
        ipHash: this.crypto.hashContext(context.ipAddress),
        userAgentHash: this.crypto.hashContext(context.userAgent)
      }
    });
    await this.recordEvent(userId, 'TWO_FACTOR_CHALLENGE_CREATED', 'INFO', undefined, undefined, false, context);

    return {
      required: true as const,
      challengeToken,
      expiresAt,
      expiresIn: 300
    };
  }

  async completeLoginChallenge(
    challengeToken: string,
    code: string,
    context: SecurityContext
  ) {
    const tokenHash = this.crypto.hashToken(challengeToken);
    const challenge = await this.prisma.securityChallenge.findUnique({
      where: { tokenHash }
    });
    if (
      !challenge ||
      challenge.purpose !== 'LOGIN_2FA' ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attemptCount >= challenge.maxAttempts
    ) {
      throw new UnauthorizedException('Challenge de connexion invalide ou expiré.');
    }

    if (
      challenge.userAgentHash &&
      challenge.userAgentHash !== this.crypto.hashContext(context.userAgent)
    ) {
      throw new UnauthorizedException('Le challenge appartient à un autre appareil.');
    }

    try {
      const factor = await this.verifySecondFactor(challenge.userId, code);
      const consumed = await this.prisma.securityChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() }
      });
      if (!consumed.count) {
        throw new ConflictException('Ce challenge a déjà été utilisé.');
      }
      await this.prisma.accountSecurity.update({
        where: { userId: challenge.userId },
        data: { failedTwoFactorAttempts: 0, lockedUntil: null }
      });
      await this.recordEvent(
        challenge.userId,
        'TWO_FACTOR_LOGIN_SUCCEEDED',
        'INFO',
        undefined,
        undefined,
        false,
        context,
        { method: factor.method }
      );
      return { userId: challenge.userId, factor };
    } catch (error) {
      const nextAttempt = challenge.attemptCount + 1;
      const locked = nextAttempt >= challenge.maxAttempts;
      await this.prisma.$transaction([
        this.prisma.securityChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { attemptCount: { increment: 1 } }
        }),
        this.prisma.accountSecurity.update({
          where: { userId: challenge.userId },
          data: {
            failedTwoFactorAttempts: { increment: 1 },
            ...(locked
              ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
              : {})
          }
        })
      ]);
      await this.recordEvent(
        challenge.userId,
        'TWO_FACTOR_LOGIN_FAILED',
        locked ? 'CRITICAL' : 'WARNING',
        undefined,
        undefined,
        locked,
        context,
        { attempt: nextAttempt, locked }
      );
      throw error;
    }
  }

  async issueTrustedDevice(
    userId: string,
    sessionId: string,
    label: string | undefined,
    platform: string | undefined,
    context: SecurityContext
  ) {
    const rawToken = randomBytes(40).toString('base64url');
    const device = await this.prisma.trustedDevice.create({
      data: {
        userId,
        deviceTokenHash: this.crypto.hashToken(rawToken),
        label: label?.trim() || this.defaultDeviceLabel(context.userAgent),
        platform: platform ?? 'UNKNOWN',
        createdBySessionId: sessionId,
        trustedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    await this.recordEvent(userId, 'TRUSTED_DEVICE_ADDED', 'HIGH', sessionId, device.id, true, context);
    return { token: rawToken, deviceId: device.id, trustedUntil: device.trustedUntil };
  }

  async renameDevice(userId: string, deviceId: string, label: string) {
    const result = await this.prisma.trustedDevice.updateMany({
      where: { id: deviceId, userId },
      data: { label: label.trim() }
    });
    if (!result.count) throw new NotFoundException('Appareil introuvable.');
    return { updated: true };
  }

  async revokeDevice(userId: string, sessionId: string | undefined, deviceId: string) {
    const result = await this.prisma.trustedDevice.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBySessionId: sessionId ?? null }
    });
    if (!result.count) throw new NotFoundException('Appareil actif introuvable.');
    await this.recordEvent(userId, 'TRUSTED_DEVICE_REVOKED', 'HIGH', sessionId, deviceId, true);
    return { revoked: true };
  }

  async reauthenticate(
    userId: string,
    sessionId: string,
    dto: ReauthenticateDto,
    context: SecurityContext
  ) {
    await this.verifyPassword(userId, dto.password);
    const security = await this.prisma.accountSecurity.findUnique({ where: { userId } });
    let assurance = 'PASSWORD';
    if (security?.twoFactorEnabled) {
      if (!dto.code) throw new UnauthorizedException('Le code 2FA est requis.');
      const factor = await this.verifySecondFactor(userId, dto.code);
      assurance = `PASSWORD_${factor.method}`;
    }

    const proofToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.reauthenticationProof.create({
      data: {
        userId,
        sessionId,
        tokenHash: this.crypto.hashToken(proofToken),
        assurance,
        expiresAt
      }
    });
    await this.recordEvent(userId, 'REAUTHENTICATION_SUCCEEDED', 'INFO', sessionId, undefined, false, context);
    return { proofToken, assurance, expiresAt, expiresIn: 600 };
  }

  async consumeReauthenticationProof(
    userId: string,
    sessionId: string,
    proofToken: string
  ) {
    const proof = await this.prisma.reauthenticationProof.findUnique({
      where: { tokenHash: this.crypto.hashToken(proofToken) }
    });
    if (
      !proof ||
      proof.userId !== userId ||
      proof.sessionId !== sessionId ||
      proof.consumedAt ||
      proof.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Preuve de réauthentification invalide ou expirée.');
    }

    const consumed = await this.prisma.reauthenticationProof.updateMany({
      where: { id: proof.id, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    if (!consumed.count) {
      throw new UnauthorizedException('Cette preuve a déjà été utilisée.');
    }
    return proof.assurance;
  }

  async sessionIsRecent(sessionId: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { createdAt: true, revokedAt: true, expiresAt: true }
    });
    return Boolean(
      session &&
      !session.revokedAt &&
      session.expiresAt > new Date() &&
      session.createdAt > new Date(Date.now() - 10 * 60 * 1000)
    );
  }

  async changePassword(
    userId: string,
    currentSessionId: string | undefined,
    dto: ChangePasswordDto,
    context: SecurityContext
  ) {
    const user = await this.verifyPassword(userId, dto.password);
    if (await argon2.verify(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent.');
    }
    const security = await this.prisma.accountSecurity.findUnique({ where: { userId } });
    if (security?.twoFactorEnabled) {
      if (!dto.code) throw new UnauthorizedException('Le code 2FA est requis.');
      await this.verifySecondFactor(userId, dto.code);
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.accountSecurity.upsert({
        where: { userId },
        create: { userId, passwordChangedAt: new Date() },
        update: { passwordChangedAt: new Date() }
      });
      await tx.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {})
        },
        data: { revokedAt: new Date() }
      });
      await tx.trustedDevice.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedBySessionId: currentSessionId ?? null }
      });
      await tx.reauthenticationProof.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: new Date() }
      });
    });

    await this.recordEvent(userId, 'PASSWORD_CHANGED', 'CRITICAL', currentSessionId, undefined, true, context);
    await this.audit.record({
      actorId: userId,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: userId,
      targetAccountId: userId
    });
    return { changed: true, otherSessionsRevoked: true };
  }

  async recordSessionCreated(
    userId: string,
    sessionId: string,
    context: SecurityContext,
    assurance: string
  ) {
    await this.recordEvent(
      userId,
      'SESSION_CREATED',
      assurance === 'PASSWORD' ? 'INFO' : 'HIGH',
      sessionId,
      undefined,
      assurance !== 'PASSWORD',
      context,
      { assurance }
    );
  }

  async cleanupAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.securityRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.securityChallenge.deleteMany({ where: { userId } }),
      this.prisma.trustedDevice.deleteMany({ where: { userId } }),
      this.prisma.reauthenticationProof.deleteMany({ where: { userId } }),
      this.prisma.securityEvent.deleteMany({ where: { userId } }),
      this.prisma.accountSecurity.deleteMany({ where: { userId } })
    ]);
  }

  async exportForAccount(userId: string) {
    const [security, devices, events] = await Promise.all([
      this.prisma.accountSecurity.findUnique({
        where: { userId },
        select: {
          twoFactorEnabled: true,
          totpConfirmedAt: true,
          failedTwoFactorAttempts: true,
          lockedUntil: true,
          passwordChangedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.trustedDevice.findMany({
        where: { userId },
        select: {
          id: true,
          label: true,
          platform: true,
          firstSeenAt: true,
          lastSeenAt: true,
          trustedUntil: true,
          revokedAt: true
        }
      }),
      this.prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    return { security, devices, events };
  }

  private async verifySecondFactor(
    userId: string,
    code: string
  ): Promise<SecondFactorResult> {
    const security = await this.requiredSecurity(userId, true);
    this.assertNotLocked(security.lockedUntil);

    if (/^\d{6}$/.test(code)) {
      const secret = this.decryptSecret(security);
      const step = this.crypto.verifyTotp(secret, code);
      if (step === null) throw new UnauthorizedException('Code 2FA invalide.');
      const consumed = await this.prisma.accountSecurity.updateMany({
        where: {
          userId,
          twoFactorEnabled: true,
          OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: step } }]
        },
        data: { lastTotpStep: step }
      });
      if (!consumed.count) {
        throw new UnauthorizedException('Ce code 2FA a déjà été utilisé.');
      }
      return { method: 'TOTP', step };
    }

    const recoveryCodes = await this.prisma.securityRecoveryCode.findMany({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'asc' }
    });
    for (const recovery of recoveryCodes) {
      if (await argon2.verify(recovery.codeHash, code)) {
        const consumed = await this.prisma.securityRecoveryCode.updateMany({
          where: { id: recovery.id, usedAt: null },
          data: { usedAt: new Date() }
        });
        if (consumed.count) return { method: 'RECOVERY_CODE' };
      }
    }

    throw new UnauthorizedException('Code 2FA ou code de récupération invalide.');
  }

  private async requiredSecurity(userId: string, enabled: boolean) {
    const security = await this.prisma.accountSecurity.findUnique({
      where: { userId }
    });
    if (!security || (enabled && !security.twoFactorEnabled)) {
      throw new BadRequestException('Le 2FA n’est pas configuré pour ce compte.');
    }
    return security;
  }

  private decryptSecret(security: {
    totpCiphertext: string | null;
    totpIv: string | null;
    totpTag: string | null;
  }) {
    if (!security.totpCiphertext || !security.totpIv || !security.totpTag) {
      throw new BadRequestException('Le secret 2FA est incomplet.');
    }
    return this.crypto.decrypt({
      ciphertext: security.totpCiphertext,
      iv: security.totpIv,
      tag: security.totpTag
    });
  }

  private async verifyPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true }
    });
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }
    return user;
  }

  private assertNotLocked(lockedUntil: Date | null) {
    if (lockedUntil && lockedUntil > new Date()) {
      throw new HttpException(
        'Le second facteur est temporairement verrouillé. Réessaie plus tard.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private generateRecoveryCodes() {
    return Array.from({ length: 10 }, () => {
      const raw = randomBytes(6).toString('hex').toUpperCase();
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    });
  }

  private defaultDeviceLabel(userAgent?: string) {
    if (!userAgent) return 'Appareil KnowMe';
    return userAgent.slice(0, 80);
  }

  private async recordEvent(
    userId: string,
    type: string,
    severity: string,
    sessionId?: string,
    deviceId?: string,
    notify = false,
    context: SecurityContext = {},
    metadata?: Prisma.InputJsonValue
  ) {
    const event = await this.prisma.securityEvent.create({
      data: {
        userId,
        type,
        severity,
        sessionId: sessionId ?? null,
        deviceId: deviceId ?? null,
        ipHash: this.crypto.hashContext(context.ipAddress),
        userAgent: context.userAgent?.slice(0, 200) ?? null,
        metadata
      }
    });

    if (notify) {
      await this.notifications.create({
        userId,
        type: `SECURITY_${type}`,
        title: this.securityTitle(type),
        body: this.securityBody(type),
        data: {
          route: '/security',
          entityType: 'SECURITY_EVENT',
          entityId: event.id
        }
      });
    }
    return event;
  }

  private securityTitle(type: string) {
    return {
      TWO_FACTOR_ENABLED: '2FA activé',
      TWO_FACTOR_DISABLED: '2FA désactivé',
      TWO_FACTOR_LOGIN_FAILED: 'Échec de vérification 2FA',
      TRUSTED_DEVICE_ADDED: 'Nouvel appareil de confiance',
      TRUSTED_DEVICE_REVOKED: 'Appareil révoqué',
      PASSWORD_CHANGED: 'Mot de passe modifié'
    }[type] ?? 'Activité de sécurité';
  }

  private securityBody(type: string) {
    return {
      TWO_FACTOR_ENABLED: 'Ton compte est maintenant protégé par un second facteur.',
      TWO_FACTOR_DISABLED: 'Le second facteur a été retiré de ton compte.',
      TWO_FACTOR_LOGIN_FAILED: 'Une tentative de connexion 2FA a échoué.',
      TRUSTED_DEVICE_ADDED: 'Un appareil a été autorisé à éviter le code 2FA pendant une durée limitée.',
      TRUSTED_DEVICE_REVOKED: 'Un appareil de confiance a été révoqué.',
      PASSWORD_CHANGED: 'Ton mot de passe a été modifié et les autres sessions ont été fermées.'
    }[type] ?? 'Un changement de sécurité a été enregistré sur ton compte.';
  }
}
