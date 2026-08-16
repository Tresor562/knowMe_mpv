import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationArchivesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [archives, memberships] = await Promise.all([
      this.prisma.conversationArchive.findMany({
        where: { userId },
        orderBy: [{ archivedAt: 'desc' }, { conversationId: 'asc' }]
      }),
      this.prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true }
      })
    ]);
    const allowed = new Set(memberships.map((membership) => membership.conversationId));
    const stale = archives
      .filter((archive) => !allowed.has(archive.conversationId))
      .map((archive) => archive.conversationId);
    if (stale.length) {
      await this.prisma.conversationArchive.deleteMany({
        where: { userId, conversationId: { in: stale } }
      });
    }
    return {
      items: archives.filter((archive) => allowed.has(archive.conversationId))
    };
  }

  async archive(userId: string, conversationId: string) {
    await this.requireMembership(userId, conversationId);
    return this.prisma.conversationArchive.upsert({
      where: { userId_conversationId: { userId, conversationId } },
      create: { userId, conversationId },
      update: { archivedAt: new Date() }
    });
  }

  async restore(userId: string, conversationId: string) {
    const deleted = await this.prisma.conversationArchive.deleteMany({
      where: { userId, conversationId }
    });
    return { restored: deleted.count > 0 };
  }

  private async requireMembership(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!membership) {
      throw new NotFoundException('CONVERSATION_ARCHIVE_TARGET_NOT_FOUND');
    }
  }
}
