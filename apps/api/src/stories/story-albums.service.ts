import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoryAlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(userId: string) {
    const albums = await this.prisma.storyAlbum.findMany({
      where: { ownerUserId: userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    const counts = await this.prisma.story.groupBy({
      by: ['albumId'],
      where: { albumId: { in: albums.map((album) => album.id) }, status: { not: 'REMOVED' } },
      _count: { id: true }
    });
    const countMap = new Map(counts.map((row) => [row.albumId, row._count.id]));
    return albums.map((album) => ({ ...album, storyCount: countMap.get(album.id) ?? 0 }));
  }

  async get(userId: string, albumId: string) {
    const album = await this.prisma.storyAlbum.findFirst({
      where: { id: albumId, ownerUserId: userId }
    });
    if (!album) {
      throw new NotFoundException({ code: 'STORY_ALBUM_NOT_FOUND', message: 'Story album not found.' });
    }
    const stories = await this.prisma.story.findMany({
      where: { albumId, authorUserId: userId, status: { not: 'REMOVED' } },
      orderBy: [{ albumPosition: 'asc' }, { createdAt: 'asc' }]
    });
    return { ...album, stories };
  }

  async add(userId: string, albumId: string, storyId: string, position?: number) {
    const [album, story] = await Promise.all([
      this.prisma.storyAlbum.findFirst({ where: { id: albumId, ownerUserId: userId } }),
      this.prisma.story.findFirst({ where: { id: storyId, authorUserId: userId, status: { not: 'REMOVED' } } })
    ]);
    if (!album) {
      throw new NotFoundException({ code: 'STORY_ALBUM_NOT_FOUND', message: 'Story album not found.' });
    }
    if (!story) {
      throw new NotFoundException({ code: 'STORY_NOT_FOUND', message: 'Story not found.' });
    }
    return this.prisma.story.update({
      where: { id: storyId },
      data: { albumId, albumPosition: Math.max(0, Math.floor(position ?? 0)), pinnedAt: story.pinnedAt ?? new Date() }
    });
  }

  async remove(userId: string, albumId: string, storyId: string) {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, authorUserId: userId, albumId }
    });
    if (!story) {
      throw new NotFoundException({ code: 'STORY_NOT_FOUND', message: 'Story not found in this album.' });
    }
    return this.prisma.story.update({
      where: { id: storyId },
      data: { albumId: null, albumPosition: 0 }
    });
  }
}
