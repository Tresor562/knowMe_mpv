import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toPublicMemberDirectoryEntry,
  validateMemberSearch
} from './profile-member-directory.domain';

@Injectable()
export class ProfileMemberDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: {
    viewerUserId: string;
    query: string;
    circleId?: string | null;
    limit?: number;
  }) {
    const validated = validateMemberSearch({
      query: input.query,
      requestedLimit: input.limit
    });

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: input.viewerUserId },
        isSuspended: false,
        OR: [
          { username: { contains: validated.query, mode: 'insensitive' } },
          { displayName: { contains: validated.query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      },
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      take: validated.limit
    });

    const ids = users.map((user) => user.id);
    const [friendships, memberships] = await Promise.all([
      ids.length
        ? this.prisma.friendship.findMany({
            where: {
              OR: [
                {
                  requesterId: input.viewerUserId,
                  addresseeId: { in: ids }
                },
                {
                  requesterId: { in: ids },
                  addresseeId: input.viewerUserId
                }
              ]
            },
            select: {
              requesterId: true,
              addresseeId: true,
              status: true
            }
          })
        : [],
      input.circleId && ids.length
        ? this.prisma.profileCircleMember.findMany({
            where: {
              circleId: input.circleId,
              userId: { in: ids }
            },
            select: {
              userId: true,
              status: true,
              role: true
            }
          })
        : []
    ]);

    const friendshipMap = new Map<string, string>();
    for (const friendship of friendships) {
      const otherId =
        friendship.requesterId === input.viewerUserId
          ? friendship.addresseeId
          : friendship.requesterId;
      friendshipMap.set(otherId, friendship.status);
    }
    const membershipMap = new Map(
      memberships.map((membership) => [membership.userId, membership])
    );

    return {
      query: validated.query,
      results: users.map((user) => {
        const membership = membershipMap.get(user.id);
        return toPublicMemberDirectoryEntry({
          ...user,
          friendshipStatus: friendshipMap.get(user.id) ?? null,
          membershipStatus: membership?.status ?? null,
          membershipRole: membership?.role ?? null
        });
      }),
      privacy: {
        serverSelectedFields: true,
        emailOmitted: true,
        knowCoinsOmitted: true,
        walletOmitted: true,
        suspendedAccountsOmitted: true
      }
    };
  }
}
