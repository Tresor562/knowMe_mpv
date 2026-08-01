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
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAttestationChallengeDto,
  VerifyAttestationDto
} from './dto/integrity.dto';

type TestAttestationPayload = {
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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
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

    return {
      nonce,
      platform: dto.platform,
      action: dto.action,
      expiresAt,
      expiresIn: 300
    };
  }

  async verify(
    userId: string,
    sessionId: string | undefined,
    dto: VerifyAttestationDto
  ) {
    if (!sessionId) throw new UnauthorizedException('Session authentifiée requise.');

    const nonceHash = this.hash(dto.nonce);
    const challenge = await this.prisma.deviceAttestationChallenge.findUnique({
      where: { nonceHash }
    });

    if (
      !challenge ||
      challenge.userId !== userId ||
      challenge.sessionId !== sessionId ||
      challenge.platform !== dto.platform ||
      challenge.action !== dto.action ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attemptCount >= challenge.maxAttempts
    ) {
      throw new UnauthorizedException('Challenge d’attestation invalide ou expiré.');
    }

    let verdict: {
      provider: string;
      verdict: string;
      issuedAt: Date;
      metadata: Prisma.InputJsonValue;
    };

    try {
      verdict = this.verifyProviderToken(dto);
    } catch (error) {
      await this.prisma.deviceAttestationChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { attemptCount: { increment: 1 } }
      });
      throw error;
    }

    if (verdict.verdict !== 'MEETS_DEVICE_INTEGRITY') {
      await this.prisma.deviceAttestationChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { attemptCount: { increment: 1 } }
      });
      throw new ForbiddenException('L’intégrité de cet appareil n’est pas suffisante.');
    }

    this.assertExpectedApp(dto.platform, dto.appIdentifier);
    const tokenHash = this.hash(dto.token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const attestation = await this.prisma.$transaction(
        async (tx) => {
          const consumed = await tx.deviceAttestationChallenge.updateMany({
            where: {
              id: challenge.id,
              consumedAt: null,
              expiresAt: { gt: new Date() },
              attemptCount: { lt: challenge.maxAttempts }
            },
            data: { consumedAt: new Date() }
          });
          if (!consumed.count) {
            throw new ConflictException('Ce challenge a déjà été utilisé.');
          }

          return tx.deviceAttestation.create({
            data: {
              userId,
              sessionId,
              deviceId: dto.deviceId,
              platform: dto.platform,
              action: dto.action,
              provider: verdict.provider,
              appIdentifier: dto.appIdentifier,
              keyIdentifier: dto.keyIdentifier?.trim() || null,
              verdict: verdict.verdict,
              tokenHash,
              issuedAt: verdict.issuedAt,
              expiresAt,
              metadata: verdict.metadata
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Cette preuve d’intégrité a déjà été utilisée.');
      }
      throw error;
    }
  }

  async listMine(userId: string) {
    const now = new Date();
    return this.prisma.deviceAttestation.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now }
      },
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
    action: string
  ) {
    const attestation = await this.prisma.deviceAttestation.findUnique({
      where: { id: attestationId }
    });
    if (
      !attestation ||
      attestation.userId !== userId ||
      attestation.sessionId !== sessionId ||
      attestation.platform !== platform ||
      attestation.action !== action ||
      attestation.verdict !== 'MEETS_DEVICE_INTEGRITY' ||
      attestation.revokedAt ||
      attestation.expiresAt <= new Date()
    ) {
      throw new ForbiddenException('Attestation active requise pour cette action.');
    }
    return attestation;
  }

  private verifyProviderToken(dto: VerifyAttestationDto) {
    if (
      this.config.get<string>('NODE_ENV') === 'test' &&
      this.config.get<string>('ALLOW_TEST_ATTESTATION') === 'true'
    ) {
      return this.verifySignedTestToken(dto);
    }

    const configured =
      dto.platform === 'ANDROID'
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

  private verifySignedTestToken(dto: VerifyAttestationDto) {
    const [prefix, encoded, signature] = dto.token.split('.');
    if (prefix !== 'test' || !encoded || !signature) {
      throw new UnauthorizedException('Jeton d’attestation de test invalide.');
    }

    const secret = this.config.get<string>('TEST_ATTESTATION_SECRET');
    if (!secret || secret.length < 24) {
      throw new ServiceUnavailableException('Secret d’attestation de test absent.');
    }

    const expected = createHmac('sha256', secret).update(encoded).digest('hex');
    const provided = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      provided.length !== expectedBuffer.length ||
      !timingSafeEqual(provided, expectedBuffer)
    ) {
      throw new UnauthorizedException('Signature d’attestation invalide.');
    }

    let payload: TestAttestationPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8')
      ) as TestAttestationPayload;
    } catch {
      throw new BadRequestException('Charge utile d’attestation invalide.');
    }

    if (
      payload.nonce !== dto.nonce ||
      payload.platform !== dto.platform ||
      payload.action !== dto.action ||
      payload.deviceId !== dto.deviceId ||
      payload.appIdentifier !== dto.appIdentifier
    ) {
      throw new UnauthorizedException('Le jeton ne correspond pas au challenge.');
    }

    const issuedAt = new Date(payload.issuedAt);
    if (
      Number.isNaN(issuedAt.getTime()) ||
      Math.abs(Date.now() - issuedAt.getTime()) > 5 * 60 * 1000
    ) {
      throw new UnauthorizedException('Jeton d’attestation trop ancien.');
    }

    return {
      provider: 'TEST_SIGNED',
      verdict: payload.verdict,
      issuedAt,
      metadata: {
        test: true,
        action: payload.action
      } as Prisma.InputJsonValue
    };
  }

  private assertExpectedApp(platform: string, appIdentifier: string) {
    const expected =
      platform === 'ANDROID'
        ? this.config.get<string>('ANDROID_APP_ID')
        : this.config.get<string>('IOS_BUNDLE_ID');

    if (expected && appIdentifier !== expected) {
      throw new ForbiddenException('Identifiant d’application non autorisé.');
    }
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
