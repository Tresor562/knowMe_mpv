import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { staffAccountSelect, toStaffBadge } from '../staff/staff-profile';
import { verificationRequestSelect, toVerificationBadge } from '../verification/verification-profile';
import { PostsService } from './posts.service';

const authorSelect = {
  id: true, username: true, displayName: true, avatarUrl: true,
  email: true,
  staffAccount: { select: staffAccountSelect },
  verificationRequests: verificationRequestSelect
} as const;

@Injectable()
export class ReelsFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService
  ) {}

  /** Subscription authorization is derived from authenticated viewer identity. */
  async following(userId: string, cursor?: string) {
    const follows = await this.prisma.creatorFollow.findMany({
      where: { followerId: userId },
      select: { creatorId: true }
    });
    if (!follows.length) return [];
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: { in: follows.map(row => row.creatorId) },
        media: { some: { mimeType: 'video/mp4' } }
      },
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: { select: authorSelect },
        _count: { select: { likes: true, comments: true } },
        media: { where: { mimeType: 'video/mp4' }, orderBy: { position: 'asc' } }
      }
    });
    return posts.map(post => {
      const { email, staffAccount, verificationRequests, ...author } = post.author;
      return {
        ...post,
        author: {
          ...author,
          staff: toStaffBadge(staffAccount, email),
          verification: toVerificationBadge(verificationRequests, new Date())
        },
        media: post.media.map(item => ({
          url: '/media/public/post/' + item.assetId,
          mimeType: item.mimeType,
          position: item.position
        }))
      };
    });
  }

  async likeStates(userId: string, rawIds: string) {
    const ids = [...new Set(rawIds.split(',').filter(id => /^[a-zA-Z0-9_-]{1,100}$/.test(id)))].slice(0, 30);
    if (!ids.length) return { likedPostIds: [] };
    const likes = await this.prisma.postLike.findMany({
      where: { userId, postId: { in: ids } },
      select: { postId: true }
    });
    return { likedPostIds: likes.map(row => row.postId) };
  }

  async toggleLike(userId: string, postId: string) {
    const changed = await this.posts.toggleLike(userId, postId);
    const count = await this.prisma.postLike.count({ where: { postId } });
    return { ...changed, count };
  }
}
