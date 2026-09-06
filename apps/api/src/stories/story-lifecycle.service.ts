import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoryLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async endLive(userId: string, storyId: string) {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, authorUserId: userId, isLive: true, status: 'PUBLISHED' }
    });
    if (!story) {
      throw new NotFoundException({ code: 'STORY_LIVE_NOT_FOUND', message: 'Live Story not found.' });
    }
    const endedAt = new Date();
    const updated = await this.prisma.story.update({
      where: { id: storyId },
      data: { isLive: false, liveEndedAt: endedAt }
    });
    await this.audit.record({
      actorId: userId,
      action: 'STORY_LIVE_ENDED',
      entity: 'Story',
      entityId: storyId,
      targetAccountId: userId,
      metadata: { endedAt: endedAt.toISOString() }
    });
    return updated;
  }
}
