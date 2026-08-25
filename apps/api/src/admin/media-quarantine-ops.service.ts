import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ExternalMediaScannerService } from '../media/external-media-scanner.service';
import { MediaStorageService } from '../media/media-storage.service';
import { AuditService } from '../observability/audit.service';
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
  if (input.infected > 0) return 'BLOCKED_INFECTED';
  if (input.unavailable > 0) return 'BLOCKED_SCANNER_UNAVAILABLE';
  if (input.quarantined > 0) return 'PENDING_QUARANTINE';
  return 'CLEAR';
}

@Injectable()
export class MediaQuarantineOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly scanner: ExternalMediaScannerService,
    private readonly audit: AuditService
  ) {}

  async getSnapshot() {
    const [quarantined, infected, unavailable, oldest] = await this.prisma.$transaction([
      this.prisma.mediaAsset.count({ where: { status: 'QUARANTINED', deletedAt: null } }),
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

  async rescanUnavailable(actorId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: assetId,
        status: 'QUARANTINED',
        scannerVerdict: 'UNAVAILABLE',
        deletedAt: null
      },
      select: {
        id: true,
        ownerId: true,
        storageKey: true,
        detectedMime: true,
        sha256: true
      }
    });
    if (!asset) {
      throw new NotFoundException('Média en quarantaine éligible introuvable.');
    }

    const buffer = await this.storage.get(asset.storageKey);
    const actualSha256 = createHash('sha256').update(buffer).digest('hex');
    if (actualSha256 !== asset.sha256) {
      await this.audit.record({
        actorId,
        action: 'MEDIA_QUARANTINE_RESCAN_BLOCKED',
        entity: 'MediaAsset',
        entityId: asset.id,
        targetAccountId: asset.ownerId,
        metadata: { reason: 'STORAGE_INTEGRITY_MISMATCH' }
      });
      throw new ConflictException('L’intégrité du média stocké ne peut pas être confirmée.');
    }

    const result = await this.scanner.scan(buffer, { mimeType: asset.detectedMime });
    const status = result.verdict === 'CLEAN' ? 'AVAILABLE' : 'QUARANTINED';
    const attemptedAt = new Date();
    const updated = await this.prisma.mediaAsset.updateMany({
      where: {
        id: asset.id,
        status: 'QUARANTINED',
        scannerVerdict: 'UNAVAILABLE',
        deletedAt: null
      },
      data: {
        status,
        scannerVerdict: result.verdict,
        scannerReference: result.reference,
        scannerAttemptCount: { increment: 1 },
        scannerLastAttemptAt: attemptedAt
      }
    });
    if (updated.count !== 1) {
      throw new ConflictException('L’état du média a changé pendant la nouvelle analyse.');
    }

    await this.audit.record({
      actorId,
      action: 'MEDIA_QUARANTINE_RESCAN',
      entity: 'MediaAsset',
      entityId: asset.id,
      targetAccountId: asset.ownerId,
      metadata: {
        previousVerdict: 'UNAVAILABLE',
        scannerVerdict: result.verdict,
        status
      }
    });

    return { assetId: asset.id, status, scannerVerdict: result.verdict };
  }
}
