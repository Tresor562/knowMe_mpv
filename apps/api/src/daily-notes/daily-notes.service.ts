import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { UpsertDailyNoteDto } from './dto/upsert-daily-note.dto';

const NOTE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const NOTE_AUTHOR_SELECT = {
  id: true, username: true, displayName: true, avatarUrl: true
} as const;

@Injectable()
export class DailyNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService
  ) {}

  async upsert(userId: string, dto: UpsertDailyNoteDto) {
    const content = dto.content.trim();
    await this.moderation.assertAllowed({
      actorId: userId, action: 'DAILY_NOTE', content
    });
    const now = new Date();
    return this.prisma.dailyNote.upsert({
      where: { userId },
      create: { userId, content, expiresAt: new Date(now.getTime() + NOTE_LIFETIME_MS) },
      update: { content, expiresAt: new Date(now.getTime() + NOTE_LIFETIME_MS) },
      include: { user: { select: NOTE_AUTHOR_SELECT } }
    });
  }

  async remove(userId: string) {
    await this.prisma.dailyNote.deleteMany({ where: { userId } });
    return { deleted: true };
  }

  async mine(userId: string) {
    return this.prisma.dailyNote.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      include: { user: { select: NOTE_AUTHOR_SELECT } }
    });
  }

  async listVisible(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
      take: 250
    });
    const allowedIds = [
      userId,
      ...friendships.map(pair => pair.requesterId === userId ? pair.addresseeId : pair.requesterId)
    ];
    const notes = await this.prisma.dailyNote.findMany({
      where: {
        userId: { in: [...new Set(allowedIds)] },
        expiresAt: { gt: new Date() },
        user: { isSuspended: false }
      },
      include: { user: { select: NOTE_AUTHOR_SELECT } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100
    });
    // The caller's note is first; other notes are most-recently updated.
    return notes.sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId));
  }
}
