import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type ProfileCircleTransportChannel = 'PUSH' | 'EMAIL';

@Injectable()
export class ProfileCircleNotificationEndpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async register(input: {
    userId: string;
    channel: ProfileCircleTransportChannel;
    address: string;
    platform?: string;
    locale?: string;
  }) {
    const address = input.address.trim();
    if (!address) throw new Error('NOTIFICATION_ENDPOINT_ADDRESS_REQUIRED');
    const addressHash = this.hash(address);
    const addressCiphertext = this.encrypt(address);
    return this.prisma.profileCircleNotificationEndpoint.upsert({
      where: {
        userId_channel_addressHash: {
          userId: input.userId,
          channel: input.channel,
          addressHash
        }
      },
      create: {
        userId: input.userId,
        channel: input.channel,
        addressHash,
        addressCiphertext,
        platform: input.platform?.trim() || null,
        locale: input.locale?.trim() || 'fr',
        status: 'ACTIVE',
        lastSeenAt: new Date()
      },
      update: {
        addressCiphertext,
        platform: input.platform?.trim() || null,
        locale: input.locale?.trim() || 'fr',
        status: 'ACTIVE',
        disabledAt: null,
        lastSeenAt: new Date()
      },
      select: {
        id: true,
        channel: true,
        platform: true,
        locale: true,
        status: true,
        lastSeenAt: true
      }
    });
  }

  async activeForUser(userId: string, channel: ProfileCircleTransportChannel) {
    const endpoints = await this.prisma.profileCircleNotificationEndpoint.findMany({
      where: { userId, channel, status: 'ACTIVE' },
      orderBy: [{ lastSuccessAt: 'desc' }, { lastSeenAt: 'desc' }]
    });
    return endpoints.map((endpoint) => ({
      id: endpoint.id,
      channel: endpoint.channel,
      platform: endpoint.platform,
      locale: endpoint.locale,
      address: this.decrypt(endpoint.addressCiphertext)
    }));
  }

  async recordSuccess(endpointId: string) {
    await this.prisma.profileCircleNotificationEndpoint.update({
      where: { id: endpointId },
      data: { failureCount: 0, lastSuccessAt: new Date(), status: 'ACTIVE' }
    });
  }

  async recordFailure(endpointId: string, permanent: boolean) {
    const endpoint = await this.prisma.profileCircleNotificationEndpoint.update({
      where: { id: endpointId },
      data: {
        failureCount: { increment: 1 },
        ...(permanent
          ? { status: 'INVALID', disabledAt: new Date() }
          : {})
      }
    });
    if (!permanent && endpoint.failureCount >= 10) {
      await this.prisma.profileCircleNotificationEndpoint.update({
        where: { id: endpointId },
        data: { status: 'DISABLED', disabledAt: new Date() }
      });
    }
  }

  async disable(userId: string, endpointId: string) {
    const result = await this.prisma.profileCircleNotificationEndpoint.updateMany({
      where: { id: endpointId, userId },
      data: { status: 'DISABLED', disabledAt: new Date() }
    });
    return result.count === 1;
  }

  private key() {
    const secret =
      this.config.get<string>('PROFILE_NOTIFICATION_ENDPOINT_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim();
    if (!secret) throw new Error('NOTIFICATION_ENDPOINT_SECRET_MISSING');
    return createHash('sha256').update(secret).digest();
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
  }

  private decrypt(value: string) {
    const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) {
      throw new Error('NOTIFICATION_ENDPOINT_CIPHERTEXT_INVALID');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(ivRaw, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  }
}
