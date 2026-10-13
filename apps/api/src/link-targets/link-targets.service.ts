import { Injectable, NotFoundException } from '@nestjs/common';
import { isKnowMeDeepLinkKind, isSafeKnowMeLinkIdentifier } from '@knowme/link-contract';
import { PrismaService } from '../prisma/prisma.service';
import { findSticker, stickerCatalog } from '../messaging/stickers/sticker-catalog';
import { ChannelsService } from '../channels/channels.service';
import { StoriesService } from '../stories/stories.service';

/**
 * Resolve a deep link using the VIEWER's permissions, never the link creator's.
 * Targets remain opaque until a signed-in viewer has passed authorization.
 */
@Injectable()
export class LinkTargetsService {
  constructor(private readonly prisma: PrismaService, private readonly stories: StoriesService, private readonly channels: ChannelsService) {}

  async resolve(viewerId: string, kind: string, id: string) {
    if (!isKnowMeDeepLinkKind(kind) || !isSafeKnowMeLinkIdentifier(id)) {
      throw new NotFoundException('Contenu indisponible.');
    }

    if (kind === 'challenge') {
      const challenge = await this.prisma.challenge.findUnique({
        where:{id},select:{id:true,creatorId:true,visibility:true,status:true}
      });
      if(challenge) {
        const participant=challenge.creatorId===viewerId ? true
          : Boolean(await this.prisma.challengeParticipant.findUnique({
            where:{challengeId_userId:{challengeId:id,userId:viewerId}},
            select:{id:true}
          }));
        if (participant || (challenge.visibility==='PUBLIC' && challenge.status==='ACTIVE')) {
          return {kind,id,webPath:`/challenges/${id}`,context:{challengeId:id}};
        }
      }
    }

    if (kind === 'profile') {
      const user = await this.prisma.user.findFirst({
        where: {OR:[{id},{username:id}]},
        select:{username:true}
      });
      if(user) return {
        kind,id,webPath:`/profile/${user.username}`,context:{username:user.username}
      };
    }

    if (kind === 'post') {
      const post = await this.prisma.post.findUnique({ where: { id }, select: { id: true } });
      if (post) return { kind, id, webPath: `/feed/${post.id}`, context: { postId: post.id } };
    }

    if (kind === 'comment') {
      const comment = await this.prisma.postComment.findUnique({
        where: { id }, select: { id: true, postId: true }
      });
      if (comment) return {
        kind, id, webPath: `/feed/${comment.postId}?comment=${comment.id}`,
        context: { postId: comment.postId, commentId: comment.id }
      };
    }

    if (kind === 'conversation' || kind === 'group') {
      const member = await this.prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: id, userId: viewerId } },
        select: { conversationId: true }
      });
      if (member) return {
        kind, id, webPath: `/messages/${member.conversationId}`,
        context: { conversationId: member.conversationId }
      };
    }

    if (kind === 'message') {
      const message = await this.prisma.message.findFirst({
        where: { id, conversation: { members: { some: { userId: viewerId } } } },
        select: { id: true, conversationId: true }
      });
      if (message) return {
        kind, id,
        webPath: `/messages/${message.conversationId}?message=${message.id}`,
        context: { conversationId: message.conversationId, messageId: message.id }
      };
    }

    if (kind === 'sticker-pack') {
      const pack = stickerCatalog().find(item => item.key === id);
      if (pack) return { kind, id, webPath: `/stickers/${pack.key}`, context: { packKey: pack.key } };
    }

    if (kind === 'sticker') {
      const parts = id.split('__');
      const resolved = parts.length === 2 ? findSticker(parts[0], parts[1]) : null;
      if (resolved) return {
        kind, id,
        webPath: `/stickers/${resolved.pack.key}?sticker=${resolved.sticker.key}`,
        context: { packKey: resolved.pack.key, stickerKey: resolved.sticker.key }
      };
    }

    if (kind === 'gift') {
      // Only the recipient may dereference an individual gift receipt.
      const gift = await this.prisma.notification.findFirst({
        where: {id,userId:viewerId,type:'SOCIAL_GIFT'},
        select:{id:true}
      });
      if (gift) return {
        kind,id,webPath:`/gifts?gift=${gift.id}`,context:{giftId:gift.id}
      };
    }

    if (kind === 'channel') {
      await this.channels.details(viewerId, id);
      return {kind,id,webPath:`/channels/${id}`,context:{channelId:id}};
    }

    if (kind === 'channel-post') {
      const post = await this.prisma.channelPost.findUnique({
        where: {id}, select: {id:true,channelId:true}
      });
      if (post) {
        await this.channels.details(viewerId, post.channelId);
        return {
          kind,id,
          webPath:`/channels/${post.channelId}?post=${post.id}`,
          context:{channelId:post.channelId,channelPostId:post.id}
        };
      }
    }

    if (kind === 'story') {
      // Delegate audience, expiry and removal rules to StoriesService.
      const story = await this.stories.get(viewerId, id);
      if (story && (story.allowSharing || story.viewer?.own)) {
        return { kind, id, webPath: `/stories/${id}`, context: { storyId: id } };
      }
    }

    if (kind === 'media' || kind === 'gif') {
      // Opening a chat attachment requires membership in its exact conversation.
      // Do not expose a private upload solely because its opaque ID is known.
      const attachment = await this.prisma.message.findFirst({
        where: {
          mediaAssetId: id,
          conversation: { members: { some: { userId: viewerId } } }
        },
        select: { id: true, conversationId: true }
      });
      if (attachment) return {
        kind, id,
        webPath: `/messages/${attachment.conversationId}?message=${attachment.id}`,
        context: { conversationId: attachment.conversationId, messageId: attachment.id, mediaId: id }
      };
    }

    // A safe, unavailable response for deleted, private and not-yet-routed content.
    // Stories and user-owned sticker collections require their own audience policy.
    throw new NotFoundException('Contenu indisponible.');
  }
}
