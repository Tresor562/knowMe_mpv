import {SocialService} from './social.service';

describe('SocialService.outgoing',()=>{
  it('filters pending sent requests by authenticated requester, without other users records',async()=>{
    const row={
      id:'request1',requesterId:'owner',addresseeId:'user2',
      status:'PENDING',createdAt:new Date('2026-10-18T09:00:00Z'),
      addressee:{id:'user2',username:'person',displayName:'Personne',
        email:'person@example.org',staffAccount:null,verificationRequests:[],
        entitlementGrants:[],avatarUrl:null,bio:null}
    };
    const findMany=jest.fn().mockResolvedValue([row]);
    const service=new SocialService(
      {friendship:{findMany}} as any,{create:jest.fn()} as any
    );
    const results=await service.outgoing('owner');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:{requesterId:'owner',status:'PENDING'},
      orderBy:{createdAt:'desc'},take:100
    }));
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('request1');
    expect(results[0]?.addressee.username).toBe('person');
    expect(JSON.stringify(results)).not.toContain('person@example.org');
  });
});
