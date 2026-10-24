import {UniversalDiscoveryService} from './universal-discovery.service';

describe('UniversalDiscoveryService',()=>{
  const now=new Date('2026-10-24T00:00:00.000Z');
  function setup(){
    const prisma={
      user:{findMany:jest.fn().mockResolvedValue([])},
      channel:{findMany:jest.fn().mockResolvedValue([])},
      post:{findMany:jest.fn().mockResolvedValue([])}
    };
    const privateSearch={search:jest.fn().mockResolvedValue({items:[]})};
    return {prisma,privateSearch,service:new UniversalDiscoveryService(
      prisma as never,privateSearch as never)};
  }
  it('never searches protected message contents directly',async()=>{
    const {service,prisma,privateSearch}=setup();
    await service.discover('me','hello');
    expect(privateSearch.search).toHaveBeenCalledWith('me','hello',50,undefined,
      'CONVERSATION,MESSAGE,CHALLENGE');
    expect(Object.keys(prisma).sort()).toEqual(['channel','post','user']);
  });
  it('returns public profiles, visible channels, posts and authorized messages',async()=>{
    const {service,prisma,privateSearch}=setup();
    prisma.user.findMany.mockResolvedValue([{id:'u',username:'hello',displayName:'Hello',
      bio:null,updatedAt:now}]);
    prisma.channel.findMany.mockResolvedValue([{id:'c',name:'Hello channel',username:'hello_news',
      description:null,updatedAt:now}]);
    prisma.post.findMany.mockResolvedValue([{id:'p',content:'hello world',updatedAt:now}]);
    privateSearch.search.mockResolvedValue({items:[{kind:'MESSAGE',id:'m',title:null,
      snippet:'hello authorized message',route:'/messages/x?message=m',updatedAt:now.toISOString()}]});
    const result=await service.discover('me','hello');
    expect(result.items.map(x=>x.kind).sort()).toEqual(['CHANNEL','MESSAGE','POST','PROFILE']);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'PROFILE',route:'/profile/hello'}),
      expect.objectContaining({kind:'CHANNEL',route:'/channels/c'})
    ]));
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:expect.objectContaining({isSuspended:false})
    }));
    const channelACL=prisma.channel.findMany.mock.calls[0][0].where.AND[1].OR;
    expect(channelACL).toEqual([
      {visibility:'PUBLIC'},{ownerId:'me'},{subscriptions:{some:{userId:'me'}}}
    ]);
  });
  it('suggestions require at least two characters and reject invalid cursors',async()=>{
    const {service}=setup();
    await expect(service.discover('me','a')).resolves.toMatchObject({items:[]});
    await expect(service.discover('me','hello',20,undefined,'INVALID')).rejects.toThrow('SEARCH_KIND_INVALID');
    await expect(service.discover('me','hello',20,'broken')).rejects.toThrow('SEARCH_CURSOR_INVALID');
  });
  it('paginates suggestions within the same query and filter set',async()=>{
    const {service,prisma}=setup();
    prisma.user.findMany.mockResolvedValue(['one','two','three'].map((id,index)=>({
      id,username:id,displayName:'hello',bio:null,updatedAt:new Date(now.getTime()-index*1000)
    })));
    const first=await service.discover('me','hello',2,undefined,'PROFILE');
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second=await service.discover('me','hello',2,first.nextCursor??undefined,'PROFILE');
    expect(second.items).toHaveLength(1);
    await expect(service.discover('me','other',2,first.nextCursor??undefined,'PROFILE'))
      .rejects.toThrow('SEARCH_CURSOR_INVALID');
  });
});
