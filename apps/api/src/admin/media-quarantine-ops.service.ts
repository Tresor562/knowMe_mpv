import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      quarantined,
      infected,
      unavailable,
      oldestQuarantinedAt: oldest?.createdAt ?? null
    };
  }
}
