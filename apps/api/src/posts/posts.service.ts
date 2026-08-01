import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        authorId,
        content: dto.content,
        imageUrl: dto.imageUrl
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  feed(cursor?: string) {
    return this.prisma.post.findMany({
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        _count: { select: { likes: true, comments: true } },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        }
      }
    });
  }

  async getById(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (!post) {
      throw new NotFoundException('Publication introuvable.');
    }

    return post;
  }

  async toggleLike(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      throw new NotFoundException('Publication introuvable.');
    }

    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await this.prisma.postLike.delete({ where: { id: existing.id } });
      return { liked: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.postLike.create({ data: { postId, userId } });

      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            userId: post.authorId,
            type: 'POST_LIKED',
            title: 'Nouvelle réaction',
            body: 'Quelqu’un aime ta publication.'
          }
        });
      }
    });

    return { liked: true };
  }

  async comment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      throw new NotFoundException('Publication introuvable.');
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.postComment.create({
        data: {
          postId,
          authorId: userId,
          content: dto.content
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        }
      });

      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            userId: post.authorId,
            type: 'POST_COMMENTED',
            title: 'Nouveau commentaire',
            body: 'Quelqu’un a commenté ta publication.'
          }
        });
      }

      return comment;
    });
  }

  async remove(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      throw new NotFoundException('Publication introuvable.');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Tu ne peux supprimer que tes propres publications.'
      );
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { deleted: true };
  }
}
