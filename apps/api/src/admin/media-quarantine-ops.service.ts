import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MediaQuarantineReadiness =
  | 'BLOCKED_INFECTED'
  | 'BLOCKED_SCANNER_UNAVAILABLE'
  | 'PENDING_QUARANTINE'
  | 'CLEAR';

export function classifyMediaQuarantineReadiness(input: {
  quarantined: number;
  infected: number;
  unavailable: number;
}): MediaQuarantineReadiness {
  if (input.infected > 0) {
    return 'BLOCKED_INFECTED';
  }
  if (input.unavailable > 0) {
    return 'BLOCKED_SCANNER_UNAVAILABLE';
  }
  if (input.quarantined > 0) {
    return 'PENDING_QUARANTINE';
  }
  return 'CLEAR';
}

@Injectable()
export class MediaQuarantineOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot() {
    const [quarantined, infected, unavailable, oldest] = await this.prisma.$transaction([
      this.prisma.mediaAsset.count({
        where: { status: 'QUARANTINED', deletedAt: null }
      }),
      this.prisma.mediaAsset.count({
        where: { status: 'QUARANTINED', scannerVerdict: 'INFECTED', deletedAt: null }
      }),
      this.prisma.mediaAsset.count({
        where: { status: 'QUARANTINED', scannerVerdict: 'UNAVAILABLE', deletedAt: null }
      }),
      this.prisma.mediaAsset.findFirst({
        where: { status: 'QUARANTINED', deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { createdAt: true }
      })
    ]);

    return {
      readiness: classifyMediaQuarantineReadiness({ quarantined, infected, unavailable }),
      quarantined,
      infected,
      unavailable,
      oldestQuarantinedAt: oldest?.createdAt ?? null
    };
  }
}
