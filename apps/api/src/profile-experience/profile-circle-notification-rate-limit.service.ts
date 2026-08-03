import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileCircleNotificationRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async consume(input: {
    scope: string;
    limit: number;
    now?: Date;
    windowMs?: number;
  }) {
    const now = input.now ?? new Date();
    const windowMs = Math.max(1_000, input.windowMs ?? 60_000);
    const limit = Math.max(1, Math.trunc(input.limit));
    const windowNumber = Math.floor(now.getTime() / windowMs);
    const windowStart = new Date(windowNumber * windowMs);
    const windowEnd = new Date(windowStart.getTime() + windowMs);
    const key = `${input.scope}:${windowMs}:${windowNumber}`;

    const bucket = await this.prisma.profileCircleNotificationRateBucket.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        limit,
        windowStart,
        windowEnd
      },
      update: {
        count: { increment: 1 },
        limit
      }
    });

    return {
      allowed: bucket.count <= limit,
      count: bucket.count,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAt: windowEnd
    };
  }

  async inspect(scope: string, now = new Date(), windowMs = 60_000) {
    const windowNumber = Math.floor(now.getTime() / windowMs);
    const key = `${scope}:${windowMs}:${windowNumber}`;
    const bucket =
      await this.prisma.profileCircleNotificationRateBucket.findUnique({
        where: { key }
      });
    return bucket
      ? {
          count: bucket.count,
          limit: bucket.limit,
          remaining: Math.max(0, bucket.limit - bucket.count),
          retryAt: bucket.windowEnd
        }
      : null;
  }

  async cleanup(now = new Date()) {
    const result = await this.prisma.profileCircleNotificationRateBucket.deleteMany({
      where: { windowEnd: { lt: new Date(now.getTime() - 60 * 60_000) } }
    });
    return result.count;
  }
}
