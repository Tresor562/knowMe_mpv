import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoryAssetPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPublishable(userId: string, assetId?: string) {
    const normalized = assetId?.trim();
    if (!normalized) return;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: normalized,
        ownerId: userId,
        purpose: 'STORY',
        deletedAt: null,
        status: 'AVAILABLE'
      },
      select: { id: true }
    });
    if (!asset) {
      throw new BadRequestException({
        code: 'STORY_MEDIA_INVALID',
        message: 'The selected Story media is unavailable.'
      });
    }
  }
}
