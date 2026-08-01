import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAttestationChallengeDto,
  VerifyAttestationDto
} from './dto/integrity.dto';

type TestPayload = {
  nonce: string;
  platform: string;
  action: string;
  deviceId: string;
  appIdentifier: string;
  verdict: string;
  issuedAt: string;
};

@Injectable()
export class IntegrityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService
  ) {}

  async createChallenge(
    userId: string,
    sessionId: string | undefined,
    dto: CreateAttestationChallengeDto
  ) {
    if (!sessionId) throw new UnauthorizedException('Session authentifiée requise.');
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 300_000);
    await this.prisma.deviceAttestationChallenge.create({
      data: {
        userId,
        sessionId,
        platform: dto.platform,
        action: dto.action,
        nonceHash: this.hash(nonce),
        expiresAt
      }
    });
    return { nonce, platform: dto.platform, action: dto.action, expiresAt, expiresIn: 300 };
  }

  async verify(
    userId: string,
    sessionId: string | undefined,
    dto: VerifyAttestationDto
  ) {
    if (!sessionId) throw new UnauthorizedException('Session authentifiée requise.');
    const challenge = await this.prisma.deviceAttestationChallenge.findUnique({
      where: { nonceHash: this.hash(dto.nonce) }
    });
    if (
      !challenge || challenge.userId !== userId || challenge.sessionId !== sessionId ||
      challenge.platform !== dto.platform || challenge.action !== dto.action ||
      challenge.consumedAt || challenge.expiresAt <= new Date() ||
      challenge.attemptCount >= challenge.maxAttempts
    ) {
      throw new UnauthorizedException('Challenge d’attestation invalide ou expiré.');
    }

    let verified: {
      provider: string;
      verdict: string;
      issuedAt: Date;
      metadata: Prisma.InputJsonValue;
    };
    try {
      verified = this.verifyProviderToken(dto);
    } catch (error) {
      await this.bumpAttempt(challenge.id);
      throw error;
    }
    if (verified.verdict !== 'MEETS_DEVICE_INTEGRITY') {
      await this.bumpAttempt(challenge.id);
      throw new ForbiddenException('L’intégrité de cet appareil n’est pas suffisante.');
    }
    this.assertExpectedApp(dto.platform, dto.appIdentifier);

    try {
      const attestation = await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.deviceAttestationChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
            attemptCount: { lt: challenge.maxAttempts }
          },
          data: { consumedAt: new Date() }
        });
        if (!consumed.count) throw new ConflictException('Ce challenge a déjà été utilisé.');
        return tx.deviceAttestation.create({
          data: {
            userId,
            sessionId,
            deviceId: dto.deviceId,
            platform: dto.platform,
            action: dto.action,
            provider: verified.provider,
            appIdentifier: dto.appIdentifier,
            keyIdentifier: dto.keyIdentifier?.trim() || null,
            verdict: verified.verdict,
            tokenHash: this.hash(dto.token),
            issuedAt: verified.issuedAt,
            expiresAt: new Date(Date.now() + 86_400_000),
            metadata: verified.metadata
          }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await this.audit.record({
        actorId: userId,
        action: 'DEVICE_ATTESTATION_VERIFIED',
        entity: 'DeviceAttestation',
        entityId: attestation.id,
        targetAccountId: userId,
        metadata: {
          platform: attestation.platform,
          provider: attestation.provider,
          action: attestation.action,
          deviceId: attestation.deviceId,
          verdict: attestation.verdict
        }
      });
      return {
        id: attestation.id,
        deviceId: attestation.deviceId,
        platform: attestation.platform,
        action: attestation.action,
        verdict: attestation.verdict,
        expiresAt: attestation.expiresAt
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cette preuve d’intégrité a déjà été utilisée.');
      }
      throw error;
    }
  }

  listMine(userId: string) {
    return this.prisma.deviceAttestation.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceId: true,
        platform: true,
        action: true,
        provider: true,
        appIdentifier: true,
        verdict: true,
        issuedAt: true,
        expiresAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async requireActive(
    userId: string,
    sessionId: string,
    attestationId: string,
    platform: string,
    action = 'purchase.verify'
  ) {
    const attestation = await this.prisma.deviceAttestation.findUnique({ where: { id: attestationId } });
    if (
      !attestation || attestation.userId !== userId ||
      attestation.sessionId !== sessionId || attestation.platform !== platform ||
      attestation.action !== action || attestation.verdict !== 'MEETS_DEVICE_INTEGRITY' ||
      attestation.revokedAt || attestation.expiresAt <= new Date()
    ) {
      throw new ForbiddenException('Attestation active requise pour cette action.');
    }
    return attestation;
  }

  private verifyProviderToken(dto: VerifyAttestationDto) {
    if (
      this.config.get<string>('NODE_ENV') === 'test' &&
      this.config.get<string>('ALLOW_TEST_ATTESTATION') === 'true'
    ) return this.verifyTestToken(dto);

    const configured = dto.platform === 'ANDROID'
      ? Boolean(this.config.get<string>('GOOGLE_PLAY_INTEGRITY_CREDENTIALS'))
      : Boolean(this.config.get<string>('APPLE_APP_ATTEST_PRIVATE_KEY'));
    if (!configured) {
      throw new ServiceUnavailableException(
        'Le fournisseur d’attestation n’est pas configuré. Validation refusée.'
      );
    }
    throw new ServiceUnavailableException(
      'Le connecteur officiel du fournisseur doit être activé avant la production.'
    );
  }

  private verifyTestToken(dto: VerifyAttestationDto) {
    const [prefix, encoded, signature] = dto.token.split('.');
    if (prefix !== 'test' || !encoded || !signature) {
      throw new UnauthorizedException('Jeton d’attestation de test invalide.');
    }
    const secret = this.config.get<string>('TEST_ATTESTATION_SECRET');
    if (!secret || secret.length < 24) {
      throw new ServiceUnavailableException('Secret d’attestation de test absent.');
    }
    const expected = Buffer.from(createHmac('sha256', secret).update(encoded).digest('hex'), 'hex');
    const provided = Buffer.from(signature, 'hex');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Signature d’attestation invalide.');
    }

    let payload: TestPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TestPayload;
    } catch {
      throw new BadRequestException('Charge utile d’attestation invalide.');
    }
    if (
      payload.nonce !== dto.nonce || payload.platform !== dto.platform ||
      payload.action !== dto.action || payload.deviceId !== dto.deviceId ||
      payload.appIdentifier !== dto.appIdentifier
    ) throw new UnauthorizedException('Le jeton ne correspond pas au challenge.');

    const issuedAt = new Date(payload.issuedAt);
    if (Number.isNaN(issuedAt.getTime()) || Math.abs(Date.now() - issuedAt.getTime()) > 300_000) {
      throw new UnauthorizedException('Jeton d’attestation trop ancien.');
    }
    return {
      provider: 'TEST_SIGNED',
      verdict: payload.verdict,
      issuedAt,
      metadata: { test: true, action: payload.action } as Prisma.InputJsonValue
    };
  }

  private assertExpectedApp(platform: string, appIdentifier: string) {
    const expected = platform === 'ANDROID'
      ? this.config.get<string>('ANDROID_APP_ID')
      : this.config.get<string>('IOS_BUNDLE_ID');
    if (expected && appIdentifier !== expected) {
      throw new ForbiddenException('Identifiant d’application non autorisé.');
    }
  }

  private bumpAttempt(id: string) {
    return this.prisma.deviceAttestationChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { attemptCount: { increment: 1 } }
    });
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
