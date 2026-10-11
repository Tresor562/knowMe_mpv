import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ChannelVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ChannelInput = {
  name?: string;
  username?: string;
  description?: string;
  visibility?: ChannelVisibility;
};

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(input: ChannelInput, creation = false) {
    const name = input.name?.trim();
    if (creation && !name) throw new BadRequestException('CHANNEL_NAME_REQUIRED');
    if (input.name !== undefined && !name) throw new BadRequestException('CHANNEL_NAME_REQUIRED');
    const username = input.username?.trim().replace(/^@/, '').toLowerCase();
    if (username && !/^[a-z][a-z0-9_]{4,31}$/.test(username)) {
      throw new BadRequestException('CHANNEL_USERNAME_INVALID');
    }
    return {
      ...(name !== undefined ? { name } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.username !== undefined ? { username: username || null } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {})
    };
  }

  private uniqueError(cause: unknown): never {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2002') {
      throw new ConflictException('CHANNEL_USERNAME_TAKEN');
    }
    throw cause;
  }

  async create(userId: string, input: ChannelInput) {
    const data = this.normalize(input, true);
    try {
      return await this.prisma.channel.create({
        data: {
          name: data.name!,
          username: data.username ?? null,
          description: data.description ?? null,
          visibility: data.visibility ?? ChannelVisibility.PUBLIC,
          ownerId: userId,
          subscriptions: { create: { userId } }
        },
        include: { _count: { select: { subscriptions: true, posts: true } } }
      });
    } catch (cause) { return this.uniqueError(cause); }
  }

  async mine(userId: string) {
    return this.prisma.channel.findMany({
      where: { OR: [{ ownerId: userId }, { subscriptions: { some: { userId } } }] },
      include: {
        _count: { select: { subscriptions: true, posts: true } },
        owner: { select: { username: true, displayName: true, avatarUrl: true } }
      },
      take: 100,
      orderBy: { updatedAt: 'desc' }
    });
  }

  async discover(userId: string, query?: string) {
    const q = query?.trim().slice(0, 70) ?? '';
    return this.prisma.channel.findMany({
      where: {
        visibility: ChannelVisibility.PUBLIC,
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' as const } }
        ] } : {})
      },
      include: {
        _count: { select: { subscriptions: true, posts: true } },
        subscriptions: { where: { userId }, select: { userId: true } }
      },
      take: 50,
      orderBy: { updatedAt: 'desc' }
    });
  }

  private async visible(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        _count: { select: { subscriptions: true, posts: true } },
        owner: { select: { username: true, displayName: true, avatarUrl: true } },
        subscriptions: { where: { userId }, select: { userId: true } }
      }
    });
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    if (channel.visibility === ChannelVisibility.PRIVATE
      && channel.ownerId !== userId && channel.subscriptions.length === 0) {
      // Do not confirm existence of private channels to outsiders.
      throw new NotFoundException('CHANNEL_NOT_FOUND');
    }
    return {
      ...channel,
      following: channel.subscriptions.length > 0,
      subscriptions: undefined
    };
  }

  details(userId: string, channelId: string) { return this.visible(userId, channelId); }

  private async owner(userId: string, channelId: string) {
    const row = await this.prisma.channel.findUnique({
      where: { id: channelId }, select: { ownerId: true, visibility: true }
    });
    if (!row) throw new NotFoundException('CHANNEL_NOT_FOUND');
    if (row.ownerId !== userId) {
      if (row.visibility === ChannelVisibility.PRIVATE) throw new NotFoundException('CHANNEL_NOT_FOUND');
      throw new ForbiddenException('CHANNEL_OWNER_ONLY');
    }
  }

  async update(userId: string, channelId: string, input: ChannelInput) {
    await this.owner(userId, channelId);
    const data = this.normalize(input);
    if (Object.keys(data).length === 0) throw new BadRequestException('CHANNEL_NO_CHANGES');
    try {
      return await this.prisma.channel.update({ where: { id: channelId }, data });
    } catch (cause) { return this.uniqueError(cause); }
  }

  async follow(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId }, select: { ownerId: true, visibility: true }
    });
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    if (channel.visibility === ChannelVisibility.PRIVATE && channel.ownerId !== userId) {
      throw new NotFoundException('CHANNEL_NOT_FOUND');
    }
    await this.prisma.channelSubscription.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId },
      update: {}
    });
    return { following: true };
  }

  async unfollow(userId: string, channelId: string) {
    await this.visible(userId, channelId);
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId }, select: { ownerId: true }
    });
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    if (channel.ownerId === userId) throw new ForbiddenException('CHANNEL_OWNER_CANNOT_LEAVE');
    await this.prisma.channelSubscription.deleteMany({ where: { channelId, userId } });
    return { following: false };
  }

  async publish(userId: string, channelId: string, content: string) {
    await this.owner(userId, channelId);
    const text = content.trim();
    if (!text) throw new BadRequestException('CHANNEL_POST_REQUIRED');
    return this.prisma.channelPost.create({
      data: { channelId, authorId: userId, content: text },
      include: { author: { select: { displayName: true, username: true } } }
    });
  }

  async posts(userId: string, channelId: string, cursor?: string) {
    await this.visible(userId, channelId);
    if (cursor) {
      const point = await this.prisma.channelPost.findFirst({
        where: { id: cursor, channelId }, select: { id: true }
      });
      if (!point) throw new BadRequestException('CHANNEL_CURSOR_INVALID');
    }
    const rows = await this.prisma.channelPost.findMany({
      where: { channelId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { author: { select: { displayName: true, username: true } } }
    });
    return { items: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null };
  }
}
