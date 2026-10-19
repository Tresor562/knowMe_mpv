import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException
} from '@nestjs/common';
import { ConversationRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorageService } from '../media/media-storage.service';

const IMAGE_MIMES=['image/jpeg','image/png','image/webp'];
const MAX_IMAGE_BYTES=5*1024*1024;

/** Group photos are private media; never use /media/public/avatar, which
 * intentionally serves only images bound to a user's account profile. */
@Injectable()
export class GroupAvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService
  ) {}

  private async member(userId: string, conversationId: string) {
    const membership=await this.prisma.conversationMember.findUnique({
      where:{conversationId_userId:{conversationId,userId}},
      include:{conversation:{select:{isGroup:true}}}
    });
    if(!membership?.conversation.isGroup)throw new NotFoundException('GROUP_NOT_FOUND');
    return membership.role;
  }

  async capabilities(userId:string,conversationId:string) {
    const role=await this.member(userId,conversationId);
    return {
      read:true,
      canEdit:role===ConversationRole.OWNER||role===ConversationRole.ADMIN,
      maxBytes:MAX_IMAGE_BYTES,
      allowedMime:IMAGE_MIMES
    };
  }

  async update(userId:string,conversationId:string,mediaAssetId:string) {
    if(!mediaAssetId || mediaAssetId.length>256)
      throw new BadRequestException('GROUP_AVATAR_INVALID');
    return this.prisma.$transaction(async tx=>{
      const member=await tx.conversationMember.findUnique({
        where:{conversationId_userId:{conversationId,userId}},
        include:{conversation:{select:{isGroup:true}}}
      });
      if(!member?.conversation.isGroup)throw new NotFoundException('GROUP_NOT_FOUND');
      if(member.role!==ConversationRole.OWNER&&member.role!==ConversationRole.ADMIN)
        throw new ForbiddenException('GROUP_PERMISSION_DENIED');
      const asset=await tx.mediaAsset.findFirst({
        where:{
          id:mediaAssetId, ownerId:userId, purpose:'AVATAR',
          status:'AVAILABLE', scannerVerdict:'CLEAN', deletedAt:null,
          detectedMime:{in:IMAGE_MIMES},
          size:{lte:MAX_IMAGE_BYTES, gte:1024}
        },
        select:{id:true}
      });
      if(!asset)throw new BadRequestException('GROUP_AVATAR_ASSET_NOT_ALLOWED');
      const record=await tx.conversationAvatar.upsert({
        where:{conversationId},
        create:{conversationId,mediaAssetId,updatedById:userId},
        update:{mediaAssetId,updatedById:userId}
      });
      return {updated:true,conversationId,updatedAt:record.updatedAt};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async remove(userId:string,conversationId:string) {
    return this.prisma.$transaction(async tx=>{
      const member=await tx.conversationMember.findUnique({
        where:{conversationId_userId:{conversationId,userId}},
        include:{conversation:{select:{isGroup:true}}}
      });
      if(!member?.conversation.isGroup)throw new NotFoundException('GROUP_NOT_FOUND');
      if(member.role!==ConversationRole.OWNER&&member.role!==ConversationRole.ADMIN)
        throw new ForbiddenException('GROUP_PERMISSION_DENIED');
      await tx.conversationAvatar.deleteMany({where:{conversationId}});
      return {removed:true,conversationId};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async read(userId:string,conversationId:string) {
    await this.member(userId,conversationId);
    const current=await this.prisma.conversationAvatar.findUnique({
      where:{conversationId},select:{mediaAssetId:true}
    });
    if(!current)throw new NotFoundException('GROUP_AVATAR_NOT_FOUND');
    const asset=await this.prisma.mediaAsset.findFirst({
      where:{
        id:current.mediaAssetId,purpose:'AVATAR',status:'AVAILABLE',
        scannerVerdict:'CLEAN',deletedAt:null,
        detectedMime:{in:IMAGE_MIMES},size:{lte:MAX_IMAGE_BYTES}
      },
      select:{storageKey:true,detectedMime:true}
    });
    if(!asset)throw new NotFoundException('GROUP_AVATAR_NOT_FOUND');
    const buffer=await this.storage.get(asset.storageKey);
    return {buffer,mimeType:asset.detectedMime};
  }
}
