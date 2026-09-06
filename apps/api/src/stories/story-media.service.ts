import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaStorageService } from '../media/media-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoriesService } from './stories.service';

@Injectable()
export class StoryMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly stories: StoriesService
  ) {}

  async read(userId: string, storyId: string) {
    const story = await this.stories.get(userId, storyId);
    if (!story.assetId) {
      throw new NotFoundException({ code: 'STORY_MEDIA_NOT_FOUND', message: 'Story media not found.' });
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: story.assetId, deletedAt: null, status: 'AVAILABLE' },
      select: { storageKey: true, detectedMime: true, originalName: true }
    });
    if (!asset) {
      throw new NotFoundException({ code: 'STORY_MEDIA_NOT_FOUND', message: 'Story media not found.' });
    }
    return {
      buffer: await this.storage.get(asset.storageKey),
      mimeType: asset.detectedMime,
      fileName: asset.originalName
    };
  }
}
