import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(currentUserId: string, query: string) {
    const normalized = query.trim();

    if (normalized.length < 2) {
      return [];
    }

    return this.prisma.user.findMany({
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
        knowCoins: true
      },
      take: 20
    });
  }

  async sendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException(
        'Tu ne peux pas t’envoyer une demande à toi-même.'
      );
    }

    const addressee = await this.prisma.user.findUnique({
      where: { id: addresseeId }
    });

    if (!addressee) {
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

    if (existing) {
      return this.prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId,
          addresseeId,
          status: 'PENDING'
        }
      });
    }

    const friendship = await this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId,
        status: 'PENDING'
      }
    });

    await this.prisma.notification.create({
      data: {
        userId: addresseeId,
        type: 'FRIEND_REQUEST',
        title: 'Nouvelle demande d’ami',
        body: 'Quelqu’un souhaite mieux te connaître.'
      }
    });

    return friendship;
  }

  async incoming(userId: string) {
    return this.prisma.friendship.findMany({
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
            bio: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async respond(userId: string, friendshipId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId }
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
      await this.prisma.notification.create({
        data: {
          userId: friendship.requesterId,
          type: 'FRIEND_ACCEPTED',
          title: 'Demande acceptée',
          body: 'Vous pouvez maintenant relever des défis ensemble.'
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
            bio: true
          }
        },
        addressee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return friendships.map((friendship) => ({
      friendshipId: friendship.id,
      user:
        friendship.requesterId === userId
          ? friendship.addressee
          : friendship.requester
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
