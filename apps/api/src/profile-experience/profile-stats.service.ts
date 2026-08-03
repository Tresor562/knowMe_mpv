import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  applyProfileStatEvent,
  ProfileStatKey,
  ProfileStatOperation,
  profileStatPrivacyPolicy,
  validateProfileStatEvent
} from './profile-stats.domain';

@Injectable()
export class ProfileStatsService {
  constructor(private readonly prisma: PrismaService) {}

  policy() {
    return profileStatPrivacyPolicy();
  }

  async record(input: {
    userId: string;
    key: ProfileStatKey;
    operation: ProfileStatOperation;
    numericValue: number;
    sourceType?: string | null;
    sourceId?: string | null;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }) {
    validateProfileStatEvent(input);
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

    const existing = await this.prisma.profileStatEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return {
        event: existing,
        replayed: true,
        snapshot: await this.prisma.profileStatSnapshot.findUnique({
          where: { userId: existing.userId }
        })
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const snapshot = await tx.profileStatSnapshot.findUnique({
          where: { userId: input.userId }
        });
        const current = this.normalizeMetrics(snapshot?.metrics);
        const metrics = applyProfileStatEvent(current, input);
        const event = await tx.profileStatEvent.create({
          data: {
            userId: input.userId,
            key: input.key,
            operation: input.operation as never,
            numericValue: input.numericValue,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata as Prisma.InputJsonValue | undefined,
            occurredAt: input.occurredAt ?? new Date()
          }
        });
        const updated = await tx.profileStatSnapshot.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            metrics: metrics as Prisma.InputJsonValue,
            version: 1
          },
          update: {
            metrics: metrics as Prisma.InputJsonValue,
            version: { increment: 1 }
          }
        });
        return { event, replayed: false, snapshot: updated };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.profileStatEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey }
        });
        if (replay) {
          return {
            event: replay,
            replayed: true,
            snapshot: await this.prisma.profileStatSnapshot.findUnique({
              where: { userId: replay.userId }
            })
          };
        }
      }
      throw error;
    }
  }

  async rebuild(userId: string) {
    const events = await this.prisma.profileStatEvent.findMany({
      where: { userId },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
    });
    let metrics: Record<string, number> = {};
    for (const event of events) {
      metrics = applyProfileStatEvent(metrics, {
        key: event.key as ProfileStatKey,
        operation: event.operation as ProfileStatOperation,
        numericValue: event.numericValue
      });
    }
    return this.prisma.profileStatSnapshot.upsert({
      where: { userId },
      create: {
        userId,
        metrics: metrics as Prisma.InputJsonValue,
        version: 1
      },
      update: {
        metrics: metrics as Prisma.InputJsonValue,
        version: { increment: 1 }
      }
    });
  }

  async ownerHistory(userId: string, take = 100) {
    return this.prisma.profileStatEvent.findMany({
      where: { userId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: Math.min(500, Math.max(1, take))
    });
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.profileStatEvent.deleteMany({ where: { userId } });
    await tx.profileStatSnapshot.deleteMany({ where: { userId } });
  }

  private normalizeMetrics(
    value: Prisma.JsonValue | null | undefined
  ): Record<string, number> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => typeof entry === 'number' && Number.isFinite(entry))
        .map(([key, entry]) => [key, entry as number])
    );
  }
}
