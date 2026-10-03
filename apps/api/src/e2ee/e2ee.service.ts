import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  E2eeOneTimePreKeyDto,
  RegisterE2eeDeviceDto,
  ReplenishE2eePreKeysDto
} from './e2ee.dto';
import {
  assertPublicKeyMaterial,
  E2EE_PROTOCOL,
  e2eeKeyDirectoryPolicy
} from './e2ee.domain';

@Injectable()
export class E2eeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return e2eeKeyDirectoryPolicy();
  }

  async register(
    userId: string,
    sessionId: string | undefined,
    dto: RegisterE2eeDeviceDto
  ) {
    const session = await this.requireActiveSession(userId, sessionId);
    const keys = this.validateOneTimePreKeys(dto.oneTimePreKeys ?? []);
    const identityKey = assertPublicKeyMaterial(dto.identityKey, 'identityKey');
    const signedPreKey = assertPublicKeyMaterial(dto.signedPreKey, 'signedPreKey');
    const signedPreKeySignature = assertPublicKeyMaterial(
      dto.signedPreKeySignature,
      'signedPreKeySignature'
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.e2eeDevice.findUnique({
        where: { sessionId: session.id }
      });

      if (existing?.revokedAt) {
        throw new ConflictException(
          'E2EE_DEVICE_REVOKED_NEW_SESSION_REQUIRED'
        );
      }

      if (existing && existing.identityKey !== identityKey) {
        throw new ConflictException(
          'E2EE_IDENTITY_KEY_REPLACEMENT_REQUIRES_NEW_SESSION'
        );
      }

      const device = existing
        ? await tx.e2eeDevice.update({
            where: { id: existing.id },
            data: {
              protocol: E2EE_PROTOCOL,
              registrationId: dto.registrationId,
              signedPreKeyId: dto.signedPreKeyId,
              signedPreKey,
              signedPreKeySignature,
              lastSeenAt: new Date()
            }
          })
        : await tx.e2eeDevice.create({
            data: {
              userId,
              sessionId: session.id,
              protocol: E2EE_PROTOCOL,
              registrationId: dto.registrationId,
              identityKey,
              signedPreKeyId: dto.signedPreKeyId,
              signedPreKey,
              signedPreKeySignature
            }
          });

      if (keys.length) {
        await tx.e2eeOneTimePreKey.createMany({
          data: keys.map((key) => ({
            deviceId: device.id,
            keyId: key.keyId,
            publicKey: key.publicKey
          })),
          skipDuplicates: true
        });
      }

      const availablePreKeys = await tx.e2eeOneTimePreKey.count({
        where: { deviceId: device.id, claimedAt: null }
      });

      return {
        id: device.id,
        protocol: device.protocol,
        registrationId: device.registrationId,
        identityFingerprint: this.fingerprint(device.identityKey),
        availablePreKeys,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt
      };
    });

    await this.audit.record({
      actorId: userId,
      action: 'E2EE_DEVICE_REGISTER',
      entity: 'E2eeDevice',
      entityId: result.id,
      targetAccountId: userId,
      metadata: {
        protocol: result.protocol,
        registrationId: result.registrationId,
        availablePreKeys: result.availablePreKeys
      }
    });

    return result;
  }

  async listMine(userId: string, currentSessionId?: string) {
    const now = new Date();
    const devices = await this.prisma.e2eeDevice.findMany({
      where: { userId },
      include: {
        session: {
          select: {
            id: true,
            revokedAt: true,
            expiresAt: true,
            userAgent: true
          }
        },
        _count: {
          select: {
            oneTimePreKeys: {
              where: { claimedAt: null }
            }
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100
    });

    return devices.map((device) => ({
      id: device.id,
      protocol: device.protocol,
      registrationId: device.registrationId,
      identityFingerprint: this.fingerprint(device.identityKey),
      availablePreKeys: device._count.oneTimePreKeys,
      session: {
        current: Boolean(
          device.sessionId && device.sessionId === currentSessionId
        ),
        active: Boolean(
          !device.revokedAt &&
          device.session &&
          !device.session.revokedAt &&
          device.session.expiresAt > now
        ),
        userAgent: device.session?.userAgent ?? null,
        expiresAt: device.session?.expiresAt ?? null
      },
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      revokedAt: device.revokedAt
    }));
  }

  async replenish(
    userId: string,
    sessionId: string | undefined,
    deviceId: string,
    dto: ReplenishE2eePreKeysDto
  ) {
    const session = await this.requireActiveSession(userId, sessionId);
    const keys = this.validateOneTimePreKeys(dto.oneTimePreKeys);

    const device = await this.prisma.e2eeDevice.findFirst({
      where: {
        id: deviceId,
        userId,
        sessionId: session.id,
        revokedAt: null
      },
      select: { id: true }
    });
    if (!device) {
      throw new NotFoundException('E2EE_ACTIVE_DEVICE_NOT_FOUND');
    }

    if (keys.length) {
      await this.prisma.e2eeOneTimePreKey.createMany({
        data: keys.map((key) => ({
          deviceId,
          keyId: key.keyId,
          publicKey: key.publicKey
        })),
        skipDuplicates: true
      });
    }

    const availablePreKeys = await this.prisma.e2eeOneTimePreKey.count({
      where: { deviceId, claimedAt: null }
    });

    await this.prisma.e2eeDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() }
    });

    return { deviceId, availablePreKeys };
  }

  async revoke(userId: string, deviceId: string) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.e2eeDevice.updateMany({
        where: { id: deviceId, userId, revokedAt: null },
        data: { revokedAt: now }
      });
      if (!changed.count) {
        throw new NotFoundException('E2EE_ACTIVE_DEVICE_NOT_FOUND');
      }
      await tx.e2eeOneTimePreKey.deleteMany({
        where: { deviceId, claimedAt: null }
      });
      return { revoked: true, revokedAt: now };
    });

    await this.audit.record({
      actorId: userId,
      action: 'E2EE_DEVICE_REVOKE',
      entity: 'E2eeDevice',
      entityId: deviceId,
      targetAccountId: userId
    });

    return result;
  }

  async claimConversationBundles(
    requesterId: string,
    conversationId: string,
    targetUserId: string
  ) {
    const [requesterMembership, targetMembership] = await Promise.all([
      this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: requesterId
          }
        },
        select: { id: true }
      }),
      this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: targetUserId
          }
        },
        select: { id: true }
      })
    ]);

    if (!requesterMembership) {
      throw new ForbiddenException('E2EE_CONVERSATION_ACCESS_DENIED');
    }
    if (!targetMembership) {
      throw new NotFoundException('E2EE_TARGET_NOT_IN_CONVERSATION');
    }

    const now = new Date();
    const bundles = await this.prisma.$transaction(
      async (tx) => {
        const devices = await tx.e2eeDevice.findMany({
          where: {
            userId: targetUserId,
            revokedAt: null,
            protocol: E2EE_PROTOCOL,
            session: {
              revokedAt: null,
              expiresAt: { gt: now }
            }
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 20
        });

        const claimed = [];
        for (const device of devices) {
          const candidate = await tx.e2eeOneTimePreKey.findFirst({
            where: { deviceId: device.id, claimedAt: null },
            orderBy: [{ keyId: 'asc' }, { id: 'asc' }]
          });

          let oneTimePreKey: { keyId: number; publicKey: string } | null = null;
          if (candidate) {
            const consumed = await tx.e2eeOneTimePreKey.updateMany({
              where: { id: candidate.id, claimedAt: null },
              data: { claimedAt: now }
            });
            if (consumed.count === 1) {
              oneTimePreKey = {
                keyId: candidate.keyId,
                publicKey: candidate.publicKey
              };
            }
          }

          claimed.push({
            deviceId: device.id,
            protocol: device.protocol,
            registrationId: device.registrationId,
            identityKey: device.identityKey,
            identityFingerprint: this.fingerprint(device.identityKey),
            signedPreKey: {
              keyId: device.signedPreKeyId,
              publicKey: device.signedPreKey,
              signature: device.signedPreKeySignature
            },
            oneTimePreKey
          });
        }

        return claimed;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    return {
      conversationId,
      targetUserId,
      protocol: E2EE_PROTOCOL,
      bundles
    };
  }

  async exportForAccount(userId: string) {
    const devices = await this.prisma.e2eeDevice.findMany({
      where: { userId },
      select: {
        id: true,
        sessionId: true,
        protocol: true,
        registrationId: true,
        identityKey: true,
        signedPreKeyId: true,
        signedPreKey: true,
        signedPreKeySignature: true,
        createdAt: true,
        updatedAt: true,
        lastSeenAt: true,
        revokedAt: true,
        _count: {
          select: {
            oneTimePreKeys: true
          }
        }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return {
      schemaVersion: 1,
      devices: devices.map((device) => ({
        id: device.id,
        sessionId: device.sessionId,
        protocol: device.protocol,
        registrationId: device.registrationId,
        identityKey: device.identityKey,
        identityFingerprint: this.fingerprint(device.identityKey),
        signedPreKey: {
          keyId: device.signedPreKeyId,
          publicKey: device.signedPreKey,
          signature: device.signedPreKeySignature
        },
        oneTimePreKeyCount: device._count.oneTimePreKeys,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        lastSeenAt: device.lastSeenAt,
        revokedAt: device.revokedAt
      }))
    };
  }

  private async requireActiveSession(
    userId: string,
    sessionId: string | undefined
  ) {
    if (!sessionId) {
      throw new UnauthorizedException('E2EE_AUTH_SESSION_REQUIRED');
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    });
    if (!session) {
      throw new UnauthorizedException('E2EE_AUTH_SESSION_INACTIVE');
    }
    return session;
  }

  private validateOneTimePreKeys(keys: E2eeOneTimePreKeyDto[]) {
    const seen = new Set<number>();
    return keys.map((key) => {
      if (seen.has(key.keyId)) {
        throw new ConflictException('E2EE_DUPLICATE_ONE_TIME_PREKEY_ID');
      }
      seen.add(key.keyId);
      return {
        keyId: key.keyId,
        publicKey: assertPublicKeyMaterial(
          key.publicKey,
          `oneTimePreKey[${key.keyId}]`
        )
      };
    });
  }

  private fingerprint(identityKey: string) {
    return createHash('sha256')
      .update(Buffer.from(identityKey, 'base64'))
      .digest('hex');
  }
}
