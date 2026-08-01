import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { staffAccountSelect, withStaffBadge } from '../staff/staff-profile';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async searchUsers(currentUserId: string, query: string) {
    const normalized = query.trim();

    if (normalized.length < 2) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        isSuspended: false,
        OR: [
          { username: { contains: normalized, mode: 'insensitive' } },
          { displayName: { contains: normalized, mode: 'insensitive' } },
          { bio: { contains: normalized, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        knowCoins: true,
        staffAccount: { select: staffAccountSelect }
      },
      take: 20
    });

    return users.map(withStaffBadge);
  }

  async sendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException(
        'Tu ne peux pas t’envoyer une demande à toi-même.'
      );
    }

    const [requester, addressee] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { displayName: true }
      }),
      this.prisma.user.findUnique({
        where: { id: addresseeId },
        select: { id: true }
      })
    ]);

    if (!requester || !addressee) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId }
        ]
      }
    });

    if (existing?.status === 'ACCEPTED') {
      throw new ConflictException('Vous êtes déjà amis.');
    }

    if (existing?.status === 'PENDING') {
      throw new ConflictException('Une demande est déjà en attente.');
    }

    const friendship = existing
      ? await this.prisma.friendship.update({
          where: { id: existing.id },
          data: {
            requesterId,
            addresseeId,
            status: 'PENDING'
          }
        })
      : await this.prisma.friendship.create({
          data: {
            requesterId,
            addresseeId,
            status: 'PENDING'
          }
        });

    await this.notifications.create({
      userId: addresseeId,
      type: 'FRIEND_REQUEST',
      title: 'Nouvelle demande d’ami',
      body: `${requester.displayName} souhaite mieux te connaître.`,
      data: {
        route: '/friends',
        entityType: 'FRIENDSHIP',
        entityId: friendship.id,
        actorId: requesterId
      }
    });

    return friendship;
  }

  async incoming(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: 'PENDING'
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            staffAccount: { select: staffAccountSelect }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return friendships.map(({ requester, ...friendship }) => ({
      ...friendship,
      requester: withStaffBadge(requester)
    }));
  }

  async respond(userId: string, friendshipId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: {
        addressee: { select: { displayName: true } }
      }
    });

    if (!friendship || friendship.addresseeId !== userId) {
      throw new NotFoundException('Demande introuvable.');
    }

    if (friendship.status !== 'PENDING') {
      throw new BadRequestException('Cette demande a déjà été traitée.');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED'
      }
    });

    if (accept) {
      await this.notifications.create({
        userId: friendship.requesterId,
        type: 'FRIEND_ACCEPTED',
        title: 'Demande acceptée',
        body: `${friendship.addressee.displayName} a accepté ta demande.`,
        data: {
          route: '/friends',
          entityType: 'FRIENDSHIP',
          entityId: friendship.id,
          actorId: userId
        }
      });
    }

    return updated;
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId },
          { addresseeId: userId }
        ]
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            staffAccount: { select: staffAccountSelect }
          }
        },
        addressee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            staffAccount: { select: staffAccountSelect }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return friendships.map((friendship) => ({
      friendshipId: friendship.id,
      user: withStaffBadge(
        friendship.requesterId === userId
          ? friendship.addressee
          : friendship.requester
      )
    }));
  }

  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (
      !friendship ||
      (friendship.requesterId !== userId &&
        friendship.addresseeId !== userId)
    ) {
      throw new NotFoundException('Relation introuvable.');
    }

    await this.prisma.friendship.delete({
      where: { id: friendshipId }
    });

    return { removed: true };
  }

  async block(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Action impossible.');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: userId }
        ]
      }
    });

    if (existing) {
      return this.prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: userId,
          addresseeId: targetUserId,
          status: 'BLOCKED'
        }
      });
    }

    return this.prisma.friendship.create({
      data: {
        requesterId: userId,
        addresseeId: targetUserId,
        status: 'BLOCKED'
      }
    });
  }
}
