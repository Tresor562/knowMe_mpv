import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorageService } from '../media/media-storage.service';
import { PostAttachmentsController } from './post-attachments.controller';
import { PostsService } from './posts.service';

describe('Public post media ownership and scanning', () => {
  const asset = {
    ownerId: 'author', purpose: 'POST', status: 'AVAILABLE',
    scannerVerdict: 'CLEAN', deletedAt: null, originalName: 'photo.jpg',
    detectedMime: 'image/jpeg', storageKey: 'private/asset.jpg'
  };
  const query = jest.fn();
  const storeGet = jest.fn();
  const controller = new PostAttachmentsController(
    { postAttachment: { findUnique: query } } as unknown as PrismaService,
    { get: storeGet } as unknown as MediaStorageService
  );
  const response = { setHeader: jest.fn() };

  beforeEach(() => { jest.resetAllMocks(); });

  it('only reads clean assets linked to a public post with matching author', async () => {
    query.mockResolvedValue({post:{authorId:'author'}, asset});
    storeGet.mockResolvedValue(Buffer.from('safe-image'));
    const output = await controller.read('post', 'asset', response);
    expect(output).toBeDefined();
    expect(storeGet).toHaveBeenCalledWith('private/asset.jpg');
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it.each([
    ['no link', null],
    ['different owner', {post:{authorId:'other'},asset}],
    ['avatar purpose', {post:{authorId:'author'},asset:{...asset,purpose:'AVATAR'}}],
    ['quarantined', {post:{authorId:'author'},asset:{...asset,status:'QUARANTINED'}}],
    ['infected', {post:{authorId:'author'},asset:{...asset,scannerVerdict:'INFECTED'}}],
    ['deleted', {post:{authorId:'author'},asset:{...asset,deletedAt:new Date()}}]
  ])('denies %s before accessing stored content', async (_, link) => {
    query.mockResolvedValue(link);
    await expect(controller.read('post','asset',response)).rejects.toBeInstanceOf(NotFoundException);
    expect(storeGet).not.toHaveBeenCalled();
  });
});

describe('Post attachment transaction', () => {
  const tx = {
    mediaAsset: { findMany: jest.fn() },
    post: { create: jest.fn(), updateMany: jest.fn() },
    postAttachment: { deleteMany: jest.fn(), createMany: jest.fn() }
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    post: { findUnique: jest.fn(), updateMany: jest.fn() }
  };
  const moderation = { assertAllowed: jest.fn() };
  let posts: PostsService;
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async callback => callback(tx));
    tx.mediaAsset.findMany.mockResolvedValue([{id:'asset-valid'}]);
    tx.post.create.mockResolvedValue({id:'post'});
    tx.post.updateMany.mockResolvedValue({count:1});
    prisma.post.findUnique.mockResolvedValue({
      id:'post',authorId:'author',content:'Hello',imageUrl:null,attachments:[{assetId:'old-asset'}]
    });
    moderation.assertAllowed.mockResolvedValue(undefined);
    posts = new PostsService(
      prisma as unknown as PrismaService,
      {} as NotificationsService,
      moderation as unknown as ModerationService
    );
    jest.spyOn(posts,'getById').mockResolvedValue({id:'post'} as never);
  });

  it('rejects foreign, pending or infected IDs without creating a post', async () => {
    tx.mediaAsset.findMany.mockResolvedValueOnce([]);
    await expect(posts.create('author',{content:'hello',assetIds:['asset-foreign']}))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.post.create).not.toHaveBeenCalled();
  });

  it('creates ordered references only after all assets pass verification', async () => {
    await posts.create('author',{content:'',assetIds:['asset-valid']});
    expect(tx.mediaAsset.findMany).toHaveBeenCalledWith({
      where:{
        id:{in:['asset-valid']},ownerId:'author',purpose:'POST',
        status:'AVAILABLE',scannerVerdict:'CLEAN',deletedAt:null
      },select:{id:true}
    });
    expect(tx.post.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({
        attachments:{create:[{assetId:'asset-valid',position:0}]}
      })
    }));
  });

  it('rejects a blank post without any attachment', async () => {
    await expect(posts.create('author',{content:' '})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces attachments atomically and preserves author boundary on edit', async () => {
    await posts.update('author','post',{content:'Hello',assetIds:['asset-valid']});
    expect(tx.post.updateMany).toHaveBeenCalledWith({
      where:{id:'post',authorId:'author'},data:{content:'Hello'}
    });
    expect(tx.postAttachment.deleteMany).toHaveBeenCalledWith({where:{postId:'post'}});
    expect(tx.postAttachment.createMany).toHaveBeenCalledWith({
      data:[{postId:'post',assetId:'asset-valid',position:0}]
    });
  });
});
