import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { staffAccountSelect, toStaffBadge, type StaffProfileRecord } from '../staff/staff-profile';
import { verificationRequestSelect, toVerificationBadge, type VerificationProfileRecord } from '../verification/verification-profile';

const publicAuthorSelect = {
  id:true, username:true, displayName:true, avatarUrl:true,
  email:true, staffAccount:{select:staffAccountSelect},
  verificationRequests:verificationRequestSelect
} as const;

/** Show current verified status on posts/comments, without leaking email or verification history. */
function publicAuthor<T extends {
  email:string|null;
  staffAccount:StaffProfileRecord;
  verificationRequests:VerificationProfileRecord;
}>(author:T) {
  const {email,staffAccount,verificationRequests,...profile}=author;
  return {
    ...profile,
    staff:toStaffBadge(staffAccount,email),
    verification:toVerificationBadge(verificationRequests,new Date())
  };
}


@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    const selected=dto.mediaAssetIds??(dto.mediaAssetId?[dto.mediaAssetId]:[]);
    const ids=[...new Set(selected)];
    if (!dto.content.trim() && !selected.length) {
      throw new BadRequestException('Ajoute du texte ou au moins un média à la publication.');
    }
    if(ids.length!==selected.length)throw new ForbiddenException('Un média ne peut être ajouté deux fois au même post.');
    const validated=[];
    for(const id of ids)validated.push(await this.media.assertOwnedPostMedia(authorId,id));
    const media=validated.map((asset,index)=>({
      assetId:asset.id,mimeType:asset.mimeType,position:index
    }));
    const imageUrl=media.length&&media[0]!.mimeType.startsWith('image/')
      ? `/media/public/post/${media[0]!.assetId}`
      :dto.imageUrl;
    const post = await this.prisma.post.create({
      data: {
        authorId, content:dto.content,imageUrl,
        media:media.length?{create:media}:undefined
      },
      include:{author:{select:publicAuthorSelect},media:{orderBy:{position:'asc'}}}
    });
    return {...post,author:publicAuthor(post.author),
      media:post.media.map(item=>({url:`/media/public/post/${item.assetId}`,
        mimeType:item.mimeType,position:item.position}))};
  }

  async editPost(authorId:string, postId:string, content:string) {
    const original=await this.prisma.post.findUnique({
      where:{id:postId},
      select:{id:true,authorId:true,imageUrl:true,
        media:{select:{assetId:true},take:1}}
    });
    if(!original)throw new NotFoundException('Publication introuvable.');
    if(original.authorId!==authorId)
      throw new ForbiddenException('Tu ne peux modifier que tes propres publications.');
    if(!content.trim() && !original.media.length && !original.imageUrl)
      throw new BadRequestException('Ajoute du texte ou au moins un média à la publication.');
    const changed=await this.prisma.post.updateMany({
      where:{id:postId,authorId},data:{content}
    });
    if(!changed.count)throw new NotFoundException('Publication introuvable.');
    // Keep existing attachments and publish visibility unchanged.
    return this.getById(postId);
  }

  async feed(cursor?: string) {
    const posts = await this.prisma.post.findMany({
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: {
          select: publicAuthorSelect
        },
        _count: { select: { likes: true, comments: true } },
        media: {orderBy: {position: 'asc'}},
        comments: {
          take: 3,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            author: {
              select: publicAuthorSelect
            }
          }
        }
      }
    });
    return posts.map(post=>({...post,author:publicAuthor(post.author),
      media:post.media.map(item=>({url:`/media/public/post/${item.assetId}`,
        mimeType:item.mimeType,position:item.position})),
      comments:post.comments.map(comment=>({...comment,author:publicAuthor(comment.author)}))}));
  }

  /**
   * Returns only posts containing published MP4 attachments, ordered newest
   * first. This avoids forcing the Reels feed to scan unrelated text/photo
   * posts, and keeps cursor semantics identical to the main post feed.
   */
  async videos(cursor?: string, followedAuthorIds?: string[]) {
    const posts = await this.prisma.post.findMany({
      where: {
        media: { some: { mimeType: 'video/mp4' } },
        ...(followedAuthorIds ? { authorId: { in: followedAuthorIds } } : {})
      },
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: { select: publicAuthorSelect },
        _count: { select: { likes: true, comments: true } },
        media: {
          where: { mimeType: 'video/mp4' },
          orderBy: { position: 'asc' }
        }
      }
    });
    return posts.map(post => ({
      ...post,
      author: publicAuthor(post.author),
      media: post.media.map(item => ({
        url: `/media/public/post/${item.assetId}`,
        mimeType: item.mimeType,
        position: item.position
      }))
    }));
  }

  /** Authenticated Reels subscribed feed. Filter on the server before pagination. */
  async videosFromFollowing(viewerId: string, cursor?: string) {
    const follows = await this.prisma.creatorFollow.findMany({
      where: { followerId: viewerId }, select: { creatorId: true }
    });
    // No subscriptions must mean no videos, never a public-feed fallback.
    if (follows.length === 0) return [];
    return this.videos(cursor, follows.map(item => item.creatorId));
  }

  async getById(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: publicAuthorSelect
        },
        _count: { select: { likes: true, comments: true } },
        media: {orderBy:{position:'asc'}},
        comments: {
          take: 50,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            author: {
              select: publicAuthorSelect
            }
          }
        }
      }
    });

    if (!post) throw new NotFoundException('Publication introuvable.');
    return {...post,author:publicAuthor(post.author),
      media:post.media.map(item=>({url:`/media/public/post/${item.assetId}`,
        mimeType:item.mimeType,position:item.position})),
      comments:post.comments.map(comment=>({...comment,author:publicAuthor(comment.author)}))};
  }

  async comments(postId: string, cursor?: string, rootsOnly = false) {
    const exists = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });
    if (!exists) throw new NotFoundException('Publication introuvable.');

    const comments = await this.prisma.postComment.findMany({
      where: { postId, ...(rootsOnly ? { parentId: null } : {}) },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: { select: publicAuthorSelect },
        _count: { select: { replies: true } }
      }
    });
    return comments.map(comment => ({ ...comment, author: publicAuthor(comment.author) }));
  }

  async commentReplies(postId: string, commentId: string, cursor?: string) {
    const parent = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId },
      select: { id: true }
    });
    if (!parent) throw new NotFoundException('Commentaire introuvable.');

    const replies = await this.prisma.postComment.findMany({
      where: { postId, parentId: commentId },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        author: { select: publicAuthorSelect },
        _count: { select: { replies: true } }
      }
    });
    return replies.map(reply => ({ ...reply, author: publicAuthor(reply.author) }));
  }

  private validateEmoji(emoji: string) {
    const parts = [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(emoji)];
    if (parts.length !== 1 ||
        !/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u.test(emoji) ||
        /[\r\n]/u.test(emoji)) {
      throw new BadRequestException('Choisis un seul emoji pour cette réaction.');
    }
  }

  async commentReactionSummaries(userId: string, postId: string, commentIds: string[]) {
    if (!commentIds.length || commentIds.length > 30) {
      throw new BadRequestException('Indique entre 1 et 30 commentaires.');
    }
    const valid = await this.prisma.postComment.findMany({
      where: { postId, id: { in: commentIds } },
      select: { id: true }
    });
    const validIds = valid.map(item => item.id);
    const [counts, own] = await Promise.all([
      this.prisma.postCommentReaction.groupBy({
        by: ['commentId', 'emoji'],
        where: { commentId: { in: validIds } },
        _count: { _all: true }
      }),
      this.prisma.postCommentReaction.findMany({
        where: { commentId: { in: validIds }, userId },
        select: { commentId: true, emoji: true }
      })
    ]);
    const answer: Record<string, {
      total: number; mine: string | null; emojis: Array<{ emoji: string; count: number }>
    }> = {};
    for (const id of validIds) answer[id] = { total: 0, mine: null, emojis: [] };
    for (const row of counts) {
      const entry = answer[row.commentId];
      if (!entry) continue;
      entry.total += row._count._all;
      entry.emojis.push({ emoji: row.emoji, count: row._count._all });
    }
    for (const item of own) {
      const entry = answer[item.commentId];
      if (entry) entry.mine = item.emoji;
    }
    for (const entry of Object.values(answer)) {
      entry.emojis.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    }
    return answer;
  }

  async setCommentReaction(userId: string, postId: string, commentId: string, emoji: string) {
    this.validateEmoji(emoji);
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId }, select: { id: true }
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');
    await this.prisma.postCommentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, emoji },
      update: { emoji }
    });
    const result = await this.commentReactionSummaries(userId, postId, [commentId]);
    return result[commentId];
  }

  async removeCommentReaction(userId: string, postId: string, commentId: string) {
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId }, select: { id: true }
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');
    await this.prisma.postCommentReaction.deleteMany({
      where: { commentId, userId }
    });
    const result = await this.commentReactionSummaries(userId, postId, [commentId]);
    return result[commentId];
  }

  /** Idempotent like for double-taps: never unlikes an already-liked post. */
  /** Hydrate visible Reels hearts from the authenticated viewer's saved state. */
  async likeStates(userId: string, postIds: string[]) {
    const safeIds = [...new Set(postIds)].filter(id => /^[a-zA-Z0-9_-]{1,100}$/.test(id)).slice(0, 30);
    if (!safeIds.length) return { likedPostIds: [] };
    const rows = await this.prisma.postLike.findMany({
      where: { userId, postId: { in: safeIds } },
      select: { postId: true }
    });
    return { likedPostIds: rows.map(item => item.postId) };
  }

  async ensureLike(userId: string, postId: string) {
    const [post, actor] = await Promise.all([
      this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } })
    ]);
    if (!post) throw new NotFoundException('Publication introuvable.');

    let created = false;
    try {
      await this.prisma.postLike.create({ data: { postId, userId } });
      created = true;
    } catch (error) {
      // Concurrent presses and previously-liked posts share the same unique
      // constraint. They are successful no-ops, not an unlike or an error.
      if (!(error && typeof error === 'object' && 'code' in error &&
        error.code === 'P2002')) throw error;
    }

    const count = await this.prisma.postLike.count({ where: { postId } });
    if (created && post.authorId !== userId) {
      // A notification failure must not turn a committed like into a
      // user-visible error that invites repeated taps.
      await Promise.allSettled([this.notifications.create({
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
      })]);
    }
    return { liked: true, count };
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
      const count = await this.prisma.postLike.count({ where: { postId } });
      return { liked: false, count };
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

    const count = await this.prisma.postLike.count({ where: { postId } });
    return { liked: true, count };
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
    let parentAuthorId: string | null = null;
    // Never attach a reply to a comment belonging to a different publication.
    if (dto.parentId) {
      const parent = await this.prisma.postComment.findFirst({
        where: { id: dto.parentId, postId },
        select: { id: true, authorId: true }
      });
      if (!parent) throw new NotFoundException('Le commentaire auquel tu réponds est introuvable.');
      parentAuthorId = parent.authorId;
    }

    const comment = await this.prisma.postComment.create({
      data: {
        postId, authorId: userId, content: dto.content.trim(),
        ...(dto.parentId ? { parentId: dto.parentId } : {})
      },
      include: {
        author: { select: publicAuthorSelect },
        _count: { select: { replies: true } }
      }
    });

    const notices: Array<Promise<unknown>> = [];
    if (post.authorId !== userId) {
      notices.push(this.notifications.create({
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
      }));
    }
    // Notify the comment's author as well, without duplicating the post
    // owner's notification or notifying the person replying to themselves.
    if (parentAuthorId && parentAuthorId !== userId && parentAuthorId !== post.authorId) {
      notices.push(this.notifications.create({
        userId: parentAuthorId,
        type: 'COMMENT_REPLIED',
        title: 'Nouvelle réponse',
        body: `${actor?.displayName ?? 'Quelqu’un'} a répondu à ton commentaire.`,
        data: {
          route: `/feed/${postId}?comment=${encodeURIComponent(comment.id)}`,
          entityType: 'POST_COMMENT',
          entityId: comment.id,
          parentCommentId: dto.parentId,
          actorId: userId
        }
      }));
    }
    // A notification outage must not convert a committed comment into a
    // reported publication error, which would invite accidental duplicate posts.
    await Promise.allSettled(notices);

    return {...comment,author:publicAuthor(comment.author)};
  }

  async editComment(userId: string, postId: string, commentId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 500) {
      throw new BadRequestException('Le commentaire doit contenir entre 1 et 500 caractères.');
    }

    // Enforce ownership and post association at write time, not just via UI.
    // This prevents a user editing someone else's comment or a mismatched post.
    const updated = await this.prisma.postComment.updateMany({
      where: { id: commentId, postId, authorId: userId },
      data: { content: trimmed }
    });
    if (!updated.count) {
      const exists = await this.prisma.postComment.findUnique({
        where: { id: commentId },
        select: { postId: true }
      });
      if (!exists || exists.postId !== postId) {
        throw new NotFoundException('Commentaire introuvable.');
      }
      throw new ForbiddenException('Tu ne peux modifier que ton propre commentaire.');
    }

    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: { author: { select: publicAuthorSelect } }
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');
    return { ...comment, author: publicAuthor(comment.author) };
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
