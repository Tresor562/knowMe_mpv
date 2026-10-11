import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly moderation: ModerationService
  ) {}

  private async assertMediaAssets(tx: Prisma.TransactionClient, ownerId: string, ids: string[]) {
    if (ids.length > 10 || new Set(ids).size !== ids.length) {
      throw new BadRequestException('Sélectionne au maximum dix médias différents.');
    }
    if (!ids.length) return;
    const available = await tx.mediaAsset.findMany({
      where: {
        id: { in: ids }, ownerId, purpose: 'POST', status: 'AVAILABLE',
        scannerVerdict: 'CLEAN', deletedAt: null
      },
      select: { id: true }
    });
    if (available.length !== ids.length) {
      throw new BadRequestException('Média absent, non autorisé ou non validé.');
    }
  }

  async create(authorId: string, dto: CreatePostDto) {
    const content = dto.content.trim();
    const ids = dto.assetIds ?? [];
    if (!content && !dto.imageUrl && !ids.length) {
      throw new BadRequestException('Ajoute un texte ou au moins un média.');
    }
    if (ids.length) {
      return this.prisma.$transaction(async tx => {
        await this.assertMediaAssets(tx, authorId, ids);
        return tx.post.create({
          data: {
            authorId, content, imageUrl: dto.imageUrl,
            attachments: { create: ids.map((assetId, position) => ({ assetId, position })) }
          },
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            attachments: {
              orderBy: { position: 'asc' },
              select: { position: true, asset: { select: {
                id: true, originalName: true, detectedMime: true, size: true
              } } }
            }
          }
        });
      });
    }
    return this.prisma.post.create({
      data: { authorId, content, imageUrl: dto.imageUrl },
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

  async update(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, content: true, imageUrl: true,
        attachments: { orderBy: { position: 'asc' }, select: { assetId: true } } }
    });
    if (!post) throw new NotFoundException('Publication introuvable.');
    if (post.authorId !== userId) {
      throw new ForbiddenException('Tu ne peux modifier que tes propres publications.');
    }

    const nextIds = dto.assetIds ?? post.attachments?.map(item => item.assetId) ?? [];
    const nextImage = dto.imageUrl === undefined ? post.imageUrl : dto.imageUrl;
    if (!dto.content.trim() && !nextImage && !nextIds.length) {
      throw new BadRequestException('Ajoute un texte ou au moins un média.');
    }

    // Never charge a content-edit policy for an unchanged caption.
    if (post.content !== dto.content.trim()) {
      await this.moderation.assertAllowed({
        actorId: userId,
        action: 'POST_EDIT',
        content: dto.content,
        targetId: postId
      });
    }

    if (dto.assetIds !== undefined) {
      await this.prisma.$transaction(async tx => {
        await this.assertMediaAssets(tx, userId, dto.assetIds!);
        const changed = await tx.post.updateMany({
          where: { id: postId, authorId: userId },
          data: {
            content: dto.content.trim(),
            ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {})
          }
        });
        if (changed.count !== 1) {
          throw new ConflictException('Publication supprimée ou modifiée.');
        }
        await tx.postAttachment.deleteMany({ where: { postId } });
        if (dto.assetIds!.length) {
          await tx.postAttachment.createMany({
            data: dto.assetIds!.map((assetId, position) => ({ postId, assetId, position }))
          });
        }
      });
      return this.getById(postId);
    }

    const changed = await this.prisma.post.updateMany({
      where: { id: postId, authorId: userId },
      data: {
        content: dto.content.trim(),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {})
      }
    });
    if (changed.count !== 1) {
      throw new ConflictException('Publication modifiée ou supprimée. Actualise le fil.');
    }
    return this.getById(postId);
  }

  feed(cursor?: string) {
    return this.prisma.post.findMany({
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        attachments: { orderBy: { position: 'asc' }, select: {
          position: true, asset: { select: { id: true, originalName: true,
            detectedMime: true, size: true, status: true, deletedAt: true } }
        } },
        comments: {
          take: 3,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        attachments: { orderBy: { position: 'asc' }, select: {
          position: true, asset: { select: { id: true, originalName: true,
            detectedMime: true, size: true, status: true, deletedAt: true } }
        } },
        comments: {
          take: 50,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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

    if (!post) throw new NotFoundException('Publication introuvable.');
    return post;
  }

  /** Bookmarks belong only to the requesting account, not to the public post. */
  async save(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });
    if (!post) throw new NotFoundException('Publication introuvable.');
    await this.prisma.savedPost.createMany({
      data: [{ userId, postId }],
      skipDuplicates: true
    });
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
    return { saved: false };
  }

  async isSaved(userId: string, postId: string) {
    const saved = await this.prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { id: true }
    });
    return { saved: Boolean(saved) };
  }

  async saved(userId: string) {
    const records = await this.prisma.savedPost.findMany({
      where: { userId },
      take: 40,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, createdAt: true,
        post: {
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            _count: { select: { likes: true, comments: true } },
            attachments: {
              orderBy: { position: 'asc' },
              select: {
                position: true,
                asset: { select: { id: true, originalName: true, detectedMime: true, size: true,
                  status: true, deletedAt: true } }
              }
            }
          }
        }
      }
    });
    return records;
  }

  async comments(postId: string, cursor?: string) {
    const exists = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });
    if (!exists) throw new NotFoundException('Publication introuvable.');

    return this.prisma.postComment.findMany({
      where: { postId },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  async toggleLike(userId: string, postId: string) {
    const [post, actor] = await Promise.all([
      this.prisma.post.findUnique({ where: { id: postId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true }
      })
    ]);

    if (!post) throw new NotFoundException('Publication introuvable.');

    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await this.prisma.postLike.delete({ where: { id: existing.id } });
      return { liked: false };
    }

    await this.prisma.postLike.create({ data: { postId, userId } });

    if (post.authorId !== userId) {
      await this.notifications.create({
        userId: post.authorId,
        type: 'POST_LIKED',
        title: 'Nouvelle réaction',
        body: `${actor?.displayName ?? 'Quelqu’un'} aime ta publication.`,
        data: {
          route: `/feed/${postId}`,
          entityType: 'POST',
          entityId: postId,
          actorId: userId
        }
      });
    }

    return { liked: true };
  }

  async comment(userId: string, postId: string, dto: CreateCommentDto) {
    const [post, actor] = await Promise.all([
      this.prisma.post.findUnique({ where: { id: postId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true }
      })
    ]);

    if (!post) throw new NotFoundException('Publication introuvable.');

    const comment = await this.prisma.postComment.create({
      data: { postId, authorId: userId, content: dto.content },
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
      await this.notifications.create({
        userId: post.authorId,
        type: 'POST_COMMENTED',
        title: 'Nouveau commentaire',
        body: `${actor?.displayName ?? 'Quelqu’un'} a commenté ta publication.`,
        data: {
          route: `/feed/${postId}`,
          entityType: 'POST',
          entityId: postId,
          commentId: comment.id,
          actorId: userId
        }
      });
    }

    return comment;
  }

  async removeComment(userId: string, postId: string, commentId: string) {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: { post: { select: { id: true, authorId: true } } }
    });

    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('Commentaire introuvable.');
    }

    if (comment.authorId !== userId && comment.post.authorId !== userId) {
      throw new ForbiddenException('Tu ne peux pas supprimer ce commentaire.');
    }

    await this.prisma.postComment.delete({ where: { id: commentId } });
    return { deleted: true };
  }

  async remove(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publication introuvable.');

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Tu ne peux supprimer que tes propres publications.'
      );
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { deleted: true };
  }
}
