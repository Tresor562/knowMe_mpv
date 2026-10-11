import { ChannelVisibility } from '@prisma/client';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';

function setup() {
  const prisma = {
    channel: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    channelSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn()
    },
    channelPost: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn()
    }
  };
  const service = new ChannelsService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe('KnowMe channels: access control and publishing boundaries', () => {
  it('never exposes private channel details to non-followers', async () => {
    const { prisma, service } = setup();
    prisma.channel.findUnique.mockResolvedValue({
      id:'hidden',ownerId:'owner',visibility:ChannelVisibility.PRIVATE,
      subscriptions:[],_count:{subscriptions:1,posts:1},owner:{username:'owner'}
    });
    await expect(service.details('stranger','hidden')).rejects.toThrow('CHANNEL_NOT_FOUND');
  });

  it('allows authorized subscribed members to read private channels', async () => {
    const { prisma, service } = setup();
    prisma.channel.findUnique.mockResolvedValue({
      id:'hidden',ownerId:'owner',visibility:ChannelVisibility.PRIVATE,
      subscriptions:[{userId:'member'}],_count:{subscriptions:2,posts:1},owner:{username:'owner'}
    });
    await expect(service.details('member','hidden')).resolves.toMatchObject({
      id:'hidden',following:true
    });
  });

  it('does not allow subscribers to publish', async () => {
    const { prisma, service } = setup();
    prisma.channel.findUnique.mockResolvedValue({ownerId:'owner'});
    await expect(service.publish('subscriber','channel','Hello')).rejects.toThrow('CHANNEL_OWNER_ONLY');
    expect(prisma.channelPost.create).not.toHaveBeenCalled();
  });

  it('does not let the owner leave their own channel', async () => {
    const { prisma, service } = setup();
    prisma.channel.findUnique.mockResolvedValue({ownerId:'owner', visibility:ChannelVisibility.PUBLIC,
      subscriptions:[{userId:'owner'}]});
    await expect(service.unfollow('owner','channel')).rejects.toThrow('CHANNEL_OWNER_CANNOT_LEAVE');
    expect(prisma.channelSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('prevents anyone from subscribing to a private channel', async () => {
    const { prisma, service } = setup();
    prisma.channel.findUnique.mockResolvedValue({
      ownerId:'owner',visibility:ChannelVisibility.PRIVATE
    });
    await expect(service.follow('stranger','channel')).rejects.toThrow('CHANNEL_NOT_FOUND');
    expect(prisma.channelSubscription.upsert).not.toHaveBeenCalled();
  });

  it('normalizes public identifiers and does not create empty names', async () => {
    const { prisma, service } = setup();
    prisma.channel.create.mockResolvedValue({id:'new-channel'});
    await service.create('owner',{name:'  My News  ',username:'@MyNews',visibility:ChannelVisibility.PUBLIC});
    expect(prisma.channel.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({name:'My News',username:'mynews',ownerId:'owner'})
    }));
    await expect(service.create('owner',{name:'   '})).rejects.toThrow('CHANNEL_NAME_REQUIRED');
  });
  it('does not confirm a private channel exists during forbidden write attempts', async () => {
    const { prisma, service } = setup();
    prisma.channel.findUnique.mockResolvedValue({
      ownerId:'owner', visibility:ChannelVisibility.PRIVATE
    });
    await expect(service.publish('outsider','private','Hello')).rejects.toThrow('CHANNEL_NOT_FOUND');
    expect(prisma.channelPost.create).not.toHaveBeenCalled();
  });

});
