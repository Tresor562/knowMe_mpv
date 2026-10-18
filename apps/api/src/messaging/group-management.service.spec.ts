import { ConversationRole } from '@prisma/client';
import { GroupManagementService } from './group-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

function setup(role: ConversationRole = ConversationRole.OWNER) {
  const tx = {
    conversation: {
      findUnique: jest.fn().mockResolvedValue({id:'group1',isGroup:true,members:[{role}]}),
      update: jest.fn().mockResolvedValue({id:'group1',title:'Updated',description:null})
    },
    conversationMember: {
      findMany: jest.fn().mockResolvedValue([{userId:'owner'},{userId:'existing'}]),
      findUnique: jest.fn().mockResolvedValue({role:ConversationRole.MEMBER}),
      createMany: jest.fn().mockResolvedValue({count:1}),
      update: jest.fn().mockResolvedValue({userId:'existing',role:ConversationRole.ADMIN}),
      delete: jest.fn().mockResolvedValue({userId:'existing'})
    },
    friendship: {
      findMany: jest.fn().mockResolvedValue([
        {requesterId:'owner',addresseeId:'friend'}
      ])
    }
  };
  const prisma={
    $transaction: jest.fn().mockImplementation(async (fn:(client:typeof tx)=>unknown)=>fn(tx)),
    conversation: {findUnique:jest.fn()},
  };
  const realtime={revokeConversationAccess:jest.fn().mockResolvedValue(undefined)};
  return {
    tx,prisma,realtime,
    service:new GroupManagementService(prisma as unknown as PrismaService,realtime as unknown as RealtimeGateway)
  };
}

describe('group management permission boundaries',()=>{
  it('keeps inaccessible groups indistinguishable from nonexistent ones',async()=>{
    const {prisma,service}=setup();
    prisma.conversation.findUnique.mockResolvedValue({id:'group1',isGroup:true,members:[
      {userId:'member',role:ConversationRole.MEMBER,user:{displayName:'Member'}}
    ]});
    await expect(service.details('outsider','group1')).rejects.toThrow('GROUP_NOT_FOUND');
  });

  it('denies edits by ordinary members',async()=>{
    const {tx,service}=setup(ConversationRole.MEMBER);
    await expect(service.update('member','group1',{title:'Hijack'})).rejects.toThrow('GROUP_PERMISSION_DENIED');
    expect(tx.conversation.update).not.toHaveBeenCalled();
  });

  it('allows admins to edit group metadata but not roles',async()=>{
    const {tx,service}=setup(ConversationRole.ADMIN);
    await expect(service.update('admin','group1',{title:' Updated '})).resolves.toMatchObject({title:'Updated'});
    expect(tx.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({title:'Updated'})
    }));
    await expect(service.setRole('admin','group1','existing','ADMIN')).rejects.toThrow('GROUP_PERMISSION_DENIED');
  });

  it('prevents demoting an existing owner',async()=>{
    const {tx,service}=setup();
    tx.conversationMember.findUnique.mockResolvedValue({role:ConversationRole.OWNER});
    await expect(service.setRole('owner','group1','owner','MEMBER')).rejects.toThrow('GROUP_OWNER_PROTECTED');
    expect(tx.conversationMember.update).not.toHaveBeenCalled();
  });

  it('only adds accepted friends and caps group size',async()=>{
    const {tx,service}=setup();
    await expect(service.addMembers('owner','group1',['stranger'])).rejects.toThrow('GROUP_ADD_FRIENDS_ONLY');
    expect(tx.conversationMember.createMany).not.toHaveBeenCalled();
    await expect(service.addMembers('owner','group1',['friend'])).resolves.toMatchObject({added:1});
    expect(tx.conversationMember.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data:[expect.objectContaining({userId:'friend',role:ConversationRole.MEMBER})]
    }));
  });

  it('removes group member and revokes all realtime conversation rooms',async()=>{
    const {service,realtime}=setup();
    await expect(service.removeMember('owner','group1','existing')).resolves.toMatchObject({removed:true});
    expect(realtime.revokeConversationAccess).toHaveBeenCalledWith('group1','existing');
  });

  it('rejects admins attempting to remove other admins',async()=>{
    const {tx,service,realtime}=setup(ConversationRole.ADMIN);
    tx.conversationMember.findUnique.mockResolvedValue({role:ConversationRole.ADMIN});
    await expect(service.removeMember('admin','group1','otheradmin')).rejects.toThrow('GROUP_PERMISSION_DENIED');
    expect(tx.conversationMember.delete).not.toHaveBeenCalled();
    expect(realtime.revokeConversationAccess).not.toHaveBeenCalled();
  });

  it('never lets the owner leave before secure ownership transfer',async()=>{
    const {tx,service,realtime}=setup();
    tx.conversationMember.findUnique.mockResolvedValue({role:ConversationRole.OWNER});
    await expect(service.removeMember('owner','group1','owner')).rejects.toThrow('GROUP_OWNER_PROTECTED');
    expect(realtime.revokeConversationAccess).not.toHaveBeenCalled();
  });
  it('allows an explicitly permitted member to edit description, not permissions',async()=>{
    const {tx,service}=setup(ConversationRole.MEMBER);
    tx.conversation.findUnique.mockResolvedValue({id:'group1',isGroup:true,members:[{
      role:ConversationRole.MEMBER}],membersCanEditInfo:true});
    await expect(service.update('member','group1',{title:'Approved'})).resolves.toMatchObject({title:'Updated'});
    await expect(service.updatePermissions('member','group1',{membersCanSendMessages:false}))
      .rejects.toThrow('GROUP_PERMISSION_DENIED');
  });

  it('lets admins set group permissions and rejects empty changes',async()=>{
    const {tx,service}=setup(ConversationRole.ADMIN);
    await expect(service.updatePermissions('admin','group1',{})).rejects.toThrow('GROUP_NO_CHANGES');
    await service.updatePermissions('admin','group1',{
      membersCanSendMessages:false,membersCanSendStickers:false
    });
    expect(tx.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({membersCanSendMessages:false,membersCanSendStickers:false})
    }));
  });

  it('allows adding accepted friends only when member was granted that permission',async()=>{
    const {tx,service}=setup(ConversationRole.MEMBER);
    tx.conversation.findUnique.mockResolvedValue({id:'group1',isGroup:true,members:[{
      role:ConversationRole.MEMBER}],membersCanAddMembers:true});
    await expect(service.addMembers('member','group1',['friend']))
      .resolves.toMatchObject({added:1});
    tx.conversation.findUnique.mockResolvedValue({id:'group1',isGroup:true,members:[{
      role:ConversationRole.MEMBER}],membersCanAddMembers:false});
    await expect(service.addMembers('member','group1',['friend']))
      .rejects.toThrow('GROUP_PERMISSION_DENIED');
  });

});
