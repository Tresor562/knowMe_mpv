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

  async comments(postId: string, cursor?: string) {
    const exists = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });
    if (!exists) throw new NotFoundException('Publication introuvable.');

    const comments = await this.prisma.postComment.findMany({
      where: { postId },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: {
          select: publicAuthorSelect
        }
      }
    });
    return comments.map(comment=>({...comment,author:publicAuthor(comment.author)}));
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
          select: publicAuthorSelect
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
