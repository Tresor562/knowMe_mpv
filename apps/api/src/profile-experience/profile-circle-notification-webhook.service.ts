import {
  Body,
  Controller,
  Headers,
  Injectable,
  Param,
  Post
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationDeadLetterService } from './profile-circle-notification-dead-letter.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

class ProfileCircleNotificationWebhookDto {
  @IsString()
  @MaxLength(180)
  eventId!: string;

  @IsString()
  @MaxLength(80)
  eventType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  attemptId?: string;

  @IsIn([
    'SENT',
    'DELIVERED',
    'TEMPORARY_FAILURE',
    'PERMANENT_FAILURE',
    'COMPLAINT'
  ])
  outcome!:
    | 'SENT'
    | 'DELIVERED'
    | 'TEMPORARY_FAILURE'
    | 'PERMANENT_FAILURE'
    | 'COMPLAINT';

  @IsInt()
  timestamp!: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

function canonicalPayload(
  provider: string,
  dto: ProfileCircleNotificationWebhookDto
) {
  return JSON.stringify({
    provider,
    eventId: dto.eventId,
    eventType: dto.eventType,
    attemptId: dto.attemptId ?? null,
    outcome: dto.outcome,
    timestamp: dto.timestamp,
    metadata: dto.metadata ?? null
  });
}

@Injectable()
export class ProfileCircleNotificationWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService,
    private readonly deadLetters: ProfileCircleNotificationDeadLetterService
  ) {}

  async process(input: {
    provider: string;
    signature: string;
    dto: ProfileCircleNotificationWebhookDto;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const provider = input.provider.trim().toLowerCase();
    const secret = this.config
      .get<string>(
        `PROFILE_NOTIFICATION_${provider.toUpperCase()}_WEBHOOK_SECRET`
      )
      ?.trim();
    if (!secret) throw new Error('NOTIFICATION_WEBHOOK_SECRET_MISSING');
    const tolerance = this.runtimeConfig.get().webhookToleranceMs;
    if (Math.abs(now.getTime() - input.dto.timestamp) > tolerance) {
      throw new Error('NOTIFICATION_WEBHOOK_TIMESTAMP_INVALID');
    }

    const payload = canonicalPayload(provider, input.dto);
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const actual = input.signature.trim().toLowerCase();
    const valid =
      expected.length === actual.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
    if (!valid) throw new Error('NOTIFICATION_WEBHOOK_SIGNATURE_INVALID');

    const signatureHash = createHash('sha256').update(actual).digest('hex');
    const receipt =
      await this.prisma.profileCircleNotificationWebhookReceipt.upsert({
        where: {
          provider_eventId: { provider, eventId: input.dto.eventId }
        },
        create: {
          provider,
          eventId: input.dto.eventId,
          eventType: input.dto.eventType,
          attemptId: input.dto.attemptId ?? null,
          signatureHash,
          metadata: input.dto.metadata ?? undefined
        },
        update: {}
      });
    if (receipt.status === 'PROCESSED') {
      return { duplicate: true, receiptId: receipt.id };
    }

    try {
      if (input.dto.attemptId) {
        if (['SENT', 'DELIVERED'].includes(input.dto.outcome)) {
          await this.prisma.profileCircleNotificationTransportAttempt.updateMany({
            where: { id: input.dto.attemptId },
            data: { status: 'SENT', sentAt: now, errorCode: null }
          });
          await this.deadLetters.resolveByAttempt(input.dto.attemptId);
        } else {
          await this.prisma.profileCircleNotificationTransportAttempt.updateMany({
            where: { id: input.dto.attemptId },
            data: {
              status: 'FAILED',
              failedAt: now,
              errorCode: `PROVIDER_${input.dto.outcome}`
            }
          });
        }
      }
      await this.prisma.profileCircleNotificationWebhookReceipt.update({
        where: { id: receipt.id },
        data: { status: 'PROCESSED', processedAt: now, errorCode: null }
      });
      return { duplicate: false, receiptId: receipt.id };
    } catch (error) {
      await this.prisma.profileCircleNotificationWebhookReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'FAILED',
          errorCode:
            error instanceof Error ? error.message.slice(0, 120) : 'UNKNOWN'
        }
      });
      throw error;
    }
  }
}

@Controller('webhooks/profile-circle-notifications')
export class ProfileCircleNotificationWebhookController {
  constructor(
    private readonly webhooks: ProfileCircleNotificationWebhookService
  ) {}

  @Post(':provider')
  process(
    @Param('provider') provider: string,
    @Headers('x-knowme-signature') signature: string,
    @Body() dto: ProfileCircleNotificationWebhookDto
  ) {
    return this.webhooks.process({ provider, signature: signature ?? '', dto });
  }
}
