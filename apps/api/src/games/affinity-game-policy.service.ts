import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAffinityPreferenceDto } from './dto/update-affinity-preference.dto';

export const DEFAULT_AFFINITY_PREFERENCE = {
  invitationsEnabled: true,
  friendsOnly: true,
  defaultShareAnswers: false,
  version: 0
} as const;

@Injectable()
export class AffinityGamePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const preference = await this.prisma.affinityGamePreference.findUnique({
      where: { userId }
    });
    return preference ?? { userId, ...DEFAULT_AFFINITY_PREFERENCE };
  }

  async update(userId: string, dto: UpdateAffinityPreferenceDto) {
    const current = await this.get(userId);
    return this.prisma.affinityGamePreference.upsert({
      where: { userId },
      create: {
        userId,
        invitationsEnabled:
          dto.invitationsEnabled ?? current.invitationsEnabled,
        friendsOnly: dto.friendsOnly ?? current.friendsOnly,
        defaultShareAnswers:
          dto.defaultShareAnswers ?? current.defaultShareAnswers,
        version: 1
      },
      update: {
        ...(dto.invitationsEnabled !== undefined
          ? { invitationsEnabled: dto.invitationsEnabled }
          : {}),
        ...(dto.friendsOnly !== undefined ? { friendsOnly: dto.friendsOnly } : {}),
        ...(dto.defaultShareAnswers !== undefined
          ? { defaultShareAnswers: dto.defaultShareAnswers }
          : {}),
        version: { increment: 1 }
      }
    });
  }

  async assertCanInviteByUsernames(ownerId: string, usernames: string[]) {
    const normalized = [...new Set(usernames.map((item) => item.toLowerCase()))];
    const opponents = await this.prisma.user.findMany({
      where: {
        username: { in: normalized, mode: 'insensitive' },
        isSuspended: false
      },
      select: { id: true }
    });
    if (opponents.length !== normalized.length) {
      throw new NotFoundException({
        code: 'GAME_OPPONENT_NOT_FOUND',
        message: 'Au moins un joueur invité est introuvable ou indisponible.'
      });
    }
    await this.assertCanInvite(
      ownerId,
      opponents.map((opponent) => opponent.id)
    );
  }

  async assertCanInvite(ownerId: string, opponentIds: string[]) {
    for (const opponentId of opponentIds) {
      const preference = await this.get(opponentId);
      if (!preference.invitationsEnabled) {
        throw new ForbiddenException({
          code: 'AFFINITY_INVITATIONS_DISABLED',
          message: 'Cette personne n’accepte pas les invitations à ce jeu.'
        });
      }
      if (!preference.friendsOnly) continue;
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: ownerId, addresseeId: opponentId },
            { requesterId: opponentId, addresseeId: ownerId }
          ]
        },
        select: { id: true }
      });
      if (!friendship) {
        throw new ForbiddenException({
          code: 'AFFINITY_FRIENDSHIP_REQUIRED',
          message: 'Cette personne réserve les invitations à ses amis.'
        });
      }
    }
  }

  async exportForAccount(userId: string) {
    return this.prisma.affinityGamePreference.findUnique({ where: { userId } });
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.affinityGamePreference.deleteMany({ where: { userId } });
  }
}
