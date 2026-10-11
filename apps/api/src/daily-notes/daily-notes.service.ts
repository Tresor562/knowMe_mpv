import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';

export type DailyNoteView = {
  id: string;
  userId: string;
  content: string;
  expiresAt: Date;
  updatedAt: Date;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
};

@Injectable()
export class DailyNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService
  ) {}

  async list(userId: string): Promise<DailyNoteView[]> {
    const now = new Date();
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }]
      },
      select: { requesterId: true, addresseeId: true },
      take: 2000
    });
    const friendIds = friendships.map(friendship =>
      friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId
    );
    return this.prisma.dailyNote.findMany({
      where: {
        expiresAt: { gt: now },
        userId: { in: [userId, ...new Set(friendIds)] },
        user: { isSuspended: false }
      },
      select: {
        id: true, userId: true, content: true, updatedAt: true, expiresAt: true,
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 120
    });
  }

  async publish(userId: string, content: string) {
    const normalized = content.trim();
    if (!normalized || normalized.length > 100) {
      throw new BadRequestException('La pensée doit contenir entre 1 et 100 caractères.');
    }
    await this.moderation.assertAllowed({
      actorId: userId, action: 'POST_CREATE', content: normalized
    });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.prisma.dailyNote.upsert({
      where: { userId },
      create: { userId, content: normalized, expiresAt },
      update: { content: normalized, expiresAt },
      select: {
        id: true, userId: true, content: true, updatedAt: true, expiresAt: true,
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });
  }

  async remove(userId: string) {
    await this.prisma.dailyNote.deleteMany({ where: { userId } });
    return { removed: true };
  }
}
