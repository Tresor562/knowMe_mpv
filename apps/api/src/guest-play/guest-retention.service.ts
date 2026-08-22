import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const GUEST_PURGE_GRACE_MS = 60 * 60 * 1000;

export function guestPurgeCutoff(now = new Date()) {
  return new Date(now.getTime() - GUEST_PURGE_GRACE_MS);
}

@Injectable()
export class GuestRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async purgeExpired(now = new Date()) {
    const cutoff = guestPurgeCutoff(now);
    const result = await this.prisma.guestIdentity.deleteMany({
      where: {
        expiresAt: { lte: cutoff }
      }
    });

    return {
      deleted: result.count,
      cutoff: cutoff.toISOString(),
      graceSeconds: GUEST_PURGE_GRACE_MS / 1000
    } as const;
  }
}
