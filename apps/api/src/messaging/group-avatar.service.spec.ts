import { ConversationRole } from '@prisma/client';
import { GroupAvatarService } from './group-avatar.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorageService } from '../media/media-storage.service';

function setup(role:ConversationRole=ConversationRole.OWNER, isGroup=true) {
  const member={role,conversation:{isGroup}};
  const tx={
    conversationMember:{findUnique:jest.fn().mockResolvedValue(member)},
    mediaAsset:{findFirst:jest.fn().mockResolvedValue({id:'asset'})},
    conversationAvatar:{
      upsert:jest.fn().mockResolvedValue({conversationId:'group',mediaAssetId:'asset',updatedAt:new Date('2026-10-18')}),
      deleteMany:jest.fn().mockResolvedValue({count:1})
    }
  };
  const prisma={
    $transaction:jest.fn().mockImplementation(async (cb:(client:typeof tx)=>unknown)=>cb(tx)),
    conversationMember:{findUnique:jest.fn().mockResolvedValue(member)},
    conversationAvatar:{findUnique:jest.fn().mockResolvedValue({mediaAssetId:'asset'})},
    mediaAsset:{findFirst:jest.fn().mockResolvedValue({storageKey:'private/asset',detectedMime:'image/png'})}
  };
  const storage={get:jest.fn().mockResolvedValue(Buffer.from('private image'))};
  const service=new GroupAvatarService(
    prisma as unknown as PrismaService,storage as unknown as MediaStorageService
  );
  return {service,prisma,tx,storage};
}

describe('group avatar privacy and durable update',()=>{
  it('hides groups from nonmembers and blocks members from updates',async()=>{
    const ordinary=setup(ConversationRole.MEMBER);
    await expect(ordinary.service.update('member','group','asset')).rejects.toThrow('GROUP_PERMISSION_DENIED');
    expect(ordinary.tx.conversationAvatar.upsert).not.toHaveBeenCalled();
    const outsider=setup(ConversationRole.MEMBER,false);
    await expect(outsider.service.capabilities('guest','group')).rejects.toThrow('GROUP_NOT_FOUND');
    await expect(outsider.service.read('guest','group')).rejects.toThrow('GROUP_NOT_FOUND');
    expect(outsider.storage.get).not.toHaveBeenCalled();
  });

  it('admin can replace a scanned owned image and respects strict media policy',async()=>{
    const {service,tx}=setup(ConversationRole.ADMIN);
    await expect(service.update('admin','group','asset')).resolves.toMatchObject({updated:true});
    expect(tx.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where:expect.objectContaining({
        ownerId:'admin',purpose:'AVATAR',status:'AVAILABLE',
        scannerVerdict:'CLEAN',deletedAt:null,
        detectedMime:{in:['image/jpeg','image/png','image/webp']},
        size:{lte:5*1024*1024,gte:1024}
      })
    }));
    expect(tx.conversationAvatar.upsert).toHaveBeenCalledTimes(1);
    tx.mediaAsset.findFirst.mockResolvedValueOnce(null);
    await expect(service.update('admin','group','foreign')).rejects.toThrow('GROUP_AVATAR_ASSET_NOT_ALLOWED');
    expect(tx.conversationAvatar.upsert).toHaveBeenCalledTimes(1);
  });

  it('non-admins cannot delete a group picture, owner can',async()=>{
    const member=setup(ConversationRole.MEMBER);
    await expect(member.service.remove('member','group')).rejects.toThrow('GROUP_PERMISSION_DENIED');
    expect(member.tx.conversationAvatar.deleteMany).not.toHaveBeenCalled();
    const owner=setup();
    await expect(owner.service.remove('owner','group')).resolves.toMatchObject({removed:true});
    expect(owner.tx.conversationAvatar.deleteMany).toHaveBeenCalledWith({
      where:{conversationId:'group'}
    });
  });

  it('serves available private media only to existing group members',async()=>{
    const {service,storage,prisma}=setup(ConversationRole.MEMBER);
    await expect(service.read('member','group')).resolves.toEqual({
      buffer:Buffer.from('private image'),mimeType:'image/png'
    });
    expect(storage.get).toHaveBeenCalledWith('private/asset');
    prisma.mediaAsset.findFirst.mockResolvedValueOnce(null);
    await expect(service.read('member','group')).rejects.toThrow('GROUP_AVATAR_NOT_FOUND');
    expect(storage.get).toHaveBeenCalledTimes(1);
  });

  it('capabilities reflect real role and not client-provided flags',async()=>{
    const member=setup(ConversationRole.MEMBER);
    await expect(member.service.capabilities('member','group')).resolves.toMatchObject({canEdit:false,read:true});
    const admin=setup(ConversationRole.ADMIN);
    await expect(admin.service.capabilities('admin','group')).resolves.toMatchObject({
      canEdit:true,maxBytes:5*1024*1024
    });
  });
});
