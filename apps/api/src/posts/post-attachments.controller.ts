import {
  Controller, Get, NotFoundException, Param, Res, StreamableFile
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorageService } from '../media/media-storage.service';

/**
 * A public post is intentionally readable without a KnowMe session.
 * Only an explicit PostAttachment on a PUBLIC feed post authorizes content delivery.
 * Private/other-purpose assets have no route here.
 */
@Controller('posts')
export class PostAttachmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService
  ) {}

  @Get(':postId/media/:assetId')
  async read(
    @Param('postId') postId: string,
    @Param('assetId') assetId: string,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }
  ) {
    const link = await this.prisma.postAttachment.findUnique({
      where: { postId_assetId: { postId, assetId } },
      include: {
        post: { select: { authorId: true } },
        asset: { select: {
          ownerId: true, purpose: true, detectedMime: true,
          storageKey: true, status: true, scannerVerdict: true,
          deletedAt: true, originalName: true
        } }
      }
    });
    if (!link || link.asset.ownerId !== link.post.authorId ||
        link.asset.purpose !== 'POST' ||
        link.asset.status !== 'AVAILABLE' ||
        link.asset.scannerVerdict !== 'CLEAN' || link.asset.deletedAt) {
      throw new NotFoundException('Média de publication introuvable.');
    }
    const mime = link.asset.detectedMime;
    const allowInline = mime.startsWith('image/') || mime.startsWith('video/') ||
      mime.startsWith('audio/');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', 'sandbox');
    response.setHeader('Cache-Control', 'private, no-store');
    const cleanName = link.asset.originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return new StreamableFile(await this.storage.get(link.asset.storageKey), {
      type: mime,
      disposition: allowInline ? 'inline' :
        'attachment; filename="' + (cleanName || 'document') + '"'
    });
  }
}
