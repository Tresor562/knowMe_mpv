import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUploadSessionDto, GrantMediaAccessDto } from './dto/media.dto';

const SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/mpeg',
  'video/mp4'
]);

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'audio/mpeg': '.mp3',
  'video/mp4': '.mp4'
};

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly storageRoot = join(process.cwd(), 'private-media');
  private readonly accountQuota = Number(process.env.MEDIA_ACCOUNT_QUOTA_BYTES ?? 500 * 1024 * 1024);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async onModuleInit() {
    await mkdir(this.storageRoot, { recursive: true });
  }

  async createUploadSession(userId: string, dto: CreateUploadSessionDto) {
    const allowedMime = [...new Set(dto.allowedMime.map((value) => value.toLowerCase()))];
    if (!allowedMime.length || allowedMime.some((value) => !SUPPORTED_MIME.has(value))) {
      throw new BadRequestException('La liste de formats contient un type non pris en charge.');
    }
    if (dto.visibility === 'CONVERSATION') {
      if (!dto.conversationId) {
        throw new BadRequestException('Une conversation est requise pour cette visibilité.');
      }
      await this.assertConversationMembership(userId, dto.conversationId);
    }

    const token = randomBytes(40).toString('base64url');
    const session = await this.prisma.mediaUploadSession.create({
      data: {
        ownerId: userId,
        tokenHash: this.hash(token),
        purpose: dto.purpose,
        visibility: dto.visibility,
        conversationId: dto.conversationId ?? null,
        maxBytes: dto.maxBytes,
        allowedMime,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });
    return {
      id: session.id,
      uploadToken: token,
      expiresAt: session.expiresAt,
      maxBytes: session.maxBytes,
      allowedMime
    };
  }

  async completeUpload(
    userId: string,
    sessionId: string,
    uploadToken: string | undefined,
    file: Express.Multer.File | undefined
  ) {
    if (!uploadToken || !file?.buffer?.length) {
      throw new BadRequestException('Fichier ou jeton d’upload absent.');
    }
    const session = await this.prisma.mediaUploadSession.findUnique({
      where: { id: sessionId }
    });
    if (
      !session ||
      session.ownerId !== userId ||
      session.tokenHash !== this.hash(uploadToken) ||
      session.consumedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session d’upload invalide ou expirée.');
    }
    if (file.size > session.maxBytes) {
      throw new BadRequestException('Le fichier dépasse la taille autorisée pour cette session.');
    }

    const detectedMime = this.detectMime(file.buffer);
    const allowedMime = session.allowedMime as string[];
    if (!detectedMime || !SUPPORTED_MIME.has(detectedMime) || !allowedMime.includes(detectedMime)) {
      throw new BadRequestException('Le contenu binaire ne correspond pas à un format autorisé.');
    }
    if (file.mimetype.toLowerCase() !== detectedMime) {
      throw new BadRequestException('Le type déclaré ne correspond pas au contenu réel.');
    }

    await this.assertQuota(userId, file.size);
    const scan = this.scan(file.buffer);
    const status = scan.verdict === 'CLEAN' ? 'AVAILABLE' : 'QUARANTINED';
    const storageKey = `${randomUUID()}${EXTENSIONS[detectedMime]}`;
    const storagePath = this.resolveStoragePath(storageKey);
    const consumedAt = new Date();

    const consumed = await this.prisma.mediaUploadSession.updateMany({
      where: {
        id: session.id,
        ownerId: userId,
        consumedAt: null,
        expiresAt: { gt: consumedAt }
      },
      data: { consumedAt }
    });
    if (!consumed.count) {
      throw new ConflictException('Cette session d’upload a déjà été consommée.');
    }

    try {
      await writeFile(storagePath, file.buffer, { flag: 'wx' });
      const asset = await this.prisma.mediaAsset.create({
        data: {
          ownerId: userId,
          storageKey,
          originalName: this.safeName(file.originalname),
          declaredMime: file.mimetype.toLowerCase(),
          detectedMime,
          size: file.size,
          sha256: this.hashBuffer(file.buffer),
          purpose: session.purpose,
          visibility: session.visibility,
          conversationId: session.conversationId,
          status,
          scannerVerdict: scan.verdict,
          scannerReference: scan.reference
        }
      });
      await this.audit.record({
        actorId: userId,
        action: 'MEDIA_UPLOAD_COMPLETE',
        entity: 'MediaAsset',
        entityId: asset.id,
        targetAccountId: userId,
        metadata: {
          purpose: asset.purpose,
          detectedMime,
          size: asset.size,
          status,
          scannerVerdict: scan.verdict
        }
      });
      return this.publicAsset(asset);
    } catch (error) {
      await rm(storagePath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async listMine(userId: string) {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    return assets.map((asset) => this.publicAsset(asset));
  }

  async issueDownloadGrant(userId: string, assetId: string) {
    const asset = await this.authorizedAsset(userId, assetId);
    if (asset.status !== 'AVAILABLE') {
      throw new ForbiddenException('Ce média n’est pas disponible au téléchargement.');
    }
    const token = randomBytes(40).toString('base64url');
    const grant = await this.prisma.mediaDownloadGrant.create({
      data: {
        assetId,
        userId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    return {
      token,
      expiresAt: grant.expiresAt,
      path: `/media/${assetId}/content?token=${encodeURIComponent(token)}`
    };
  }

  async readContent(userId: string, assetId: string, token: string | undefined) {
    if (!token) throw new UnauthorizedException('Jeton de téléchargement absent.');
    const grant = await this.prisma.mediaDownloadGrant.findUnique({
      where: { tokenHash: this.hash(token) }
    });
    if (
      !grant ||
      grant.assetId !== assetId ||
      grant.userId !== userId ||
      grant.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Jeton de téléchargement invalide ou expiré.');
    }
    const asset = await this.authorizedAsset(userId, assetId);
    if (asset.status !== 'AVAILABLE') {
      throw new ForbiddenException('Média indisponible.');
    }
    await this.prisma.mediaDownloadGrant.update({
      where: { id: grant.id },
      data: { usedAt: new Date() }
    });
    return {
      buffer: await readFile(this.resolveStoragePath(asset.storageKey)),
      mimeType: asset.detectedMime,
      fileName: asset.originalName
    };
  }

  async grantAccess(ownerId: string, assetId: string, dto: GrantMediaAccessDto) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId, deletedAt: null }
    });
    if (!asset) throw new NotFoundException('Média introuvable.');
    const user = await this.prisma.user.findUnique({ where: { id: dto.granteeId }, select: { id: true } });
    if (!user) throw new NotFoundException('Compte destinataire introuvable.');
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) {
      throw new BadRequestException('Date d’expiration invalide.');
    }
    return this.prisma.mediaAccessGrant.upsert({
      where: { assetId_granteeId: { assetId, granteeId: dto.granteeId } },
      create: { assetId, granteeId: dto.granteeId, grantedBy: ownerId, expiresAt },
      update: { grantedBy: ownerId, expiresAt, revokedAt: null }
    });
  }

  async revokeAccess(ownerId: string, assetId: string, granteeId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId, deletedAt: null }
    });
    if (!asset) throw new NotFoundException('Média introuvable.');
    const result = await this.prisma.mediaAccessGrant.updateMany({
      where: { assetId, granteeId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    if (!result.count) throw new NotFoundException('Autorisation active introuvable.');
    return { revoked: true };
  }

  async deleteAsset(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, deletedAt: null }
    });
    if (!asset) throw new NotFoundException('Média introuvable.');
    await this.prisma.$transaction([
      this.prisma.mediaDownloadGrant.deleteMany({ where: { assetId } }),
      this.prisma.mediaAccessGrant.deleteMany({ where: { assetId } }),
      this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'DELETED', deletedAt: new Date() }
      })
    ]);
    await rm(this.resolveStoragePath(asset.storageKey), { force: true });
    await this.audit.record({
      actorId: userId,
      action: 'MEDIA_DELETE',
      entity: 'MediaAsset',
      entityId: assetId,
      targetAccountId: userId
    });
    return { deleted: true };
  }

  async cleanupAccount(userId: string) {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { ownerId: userId },
      select: { id: true, storageKey: true }
    });
    const assetIds = assets.map((asset) => asset.id);
    await this.prisma.$transaction([
      this.prisma.mediaDownloadGrant.deleteMany({
        where: { OR: [{ userId }, { assetId: { in: assetIds } }] }
      }),
      this.prisma.mediaAccessGrant.deleteMany({
        where: { OR: [{ granteeId: userId }, { assetId: { in: assetIds } }] }
      }),
      this.prisma.mediaAsset.deleteMany({ where: { ownerId: userId } }),
      this.prisma.mediaUploadSession.deleteMany({ where: { ownerId: userId } })
    ]);
    await Promise.all(
      assets.map((asset) => rm(this.resolveStoragePath(asset.storageKey), { force: true }))
    );
  }

  private async authorizedAsset(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null }
    });
    if (!asset) throw new NotFoundException('Média introuvable.');
    if (asset.ownerId === userId) return asset;

    const grant = await this.prisma.mediaAccessGrant.findFirst({
      where: {
        assetId,
        granteeId: userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    if (grant) return asset;

    if (asset.visibility === 'CONVERSATION' && asset.conversationId) {
      await this.assertConversationMembership(userId, asset.conversationId);
      return asset;
    }
    if (asset.visibility === 'FRIENDS') {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId, addresseeId: asset.ownerId },
            { requesterId: asset.ownerId, addresseeId: userId }
          ]
        }
      });
      if (friendship) return asset;
    }
    throw new ForbiddenException('Accès au média refusé.');
  }

  private async assertConversationMembership(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });
    if (!member) throw new ForbiddenException('Tu ne participes pas à cette conversation.');
  }

  private async assertQuota(userId: string, incomingBytes: number) {
    const aggregate = await this.prisma.mediaAsset.aggregate({
      where: { ownerId: userId, deletedAt: null },
      _sum: { size: true }
    });
    if ((aggregate._sum.size ?? 0) + incomingBytes > this.accountQuota) {
      throw new ForbiddenException('Quota de stockage média dépassé.');
    }
  }

  private scan(buffer: Buffer) {
    if (buffer.toString('ascii').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      return { verdict: 'INFECTED', reference: 'LOCAL:EICAR' };
    }
    if (process.env.NODE_ENV === 'production' && process.env.MEDIA_SCANNER_MODE === 'disabled') {
      return { verdict: 'UNAVAILABLE', reference: 'SCANNER_DISABLED' };
    }
    return { verdict: 'CLEAN', reference: 'LOCAL_SIGNATURE_V1' };
  }

  private detectMime(buffer: Buffer) {
    if (buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
    if (buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
    if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
    return null;
  }

  private publicAsset<T extends { storageKey: string }>(asset: T) {
    const { storageKey, ...safe } = asset;
    return safe;
  }

  private resolveStoragePath(storageKey: string) {
    const safe = basename(storageKey);
    if (safe !== storageKey) throw new BadRequestException('Clé de stockage invalide.');
    return join(this.storageRoot, safe);
  }

  private safeName(value: string) {
    return basename(value).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) || 'media';
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashBuffer(value: Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }
}
