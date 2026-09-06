import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoryInteractionNotifier {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async reaction(storyId: string, actorId: string, reaction: string) {
    const context = await this.context(storyId, actorId);
    if (!context || context.story.authorUserId === actorId) return;
    await this.notifications.create({
      userId: context.story.authorUserId,
      type: 'STORY_REACTION',
      title: 'New Story reaction',
      body: `${context.actor.displayName} reacted ${reaction} to your Story.`,
      data: { route: `/stories/${storyId}`, storyId, actorId }
    });
  }

  async reply(storyId: string, actorId: string) {
    const context = await this.context(storyId, actorId);
    if (!context || context.story.authorUserId === actorId) return;
    await this.notifications.create({
      userId: context.story.authorUserId,
      type: 'STORY_REPLY',
      title: 'New Story reply',
      body: `${context.actor.displayName} replied to your Story.`,
      data: { route: `/stories/${storyId}`, storyId, actorId }
    });
  }

  async screenshot(storyId: string, actorId: string) {
    const context = await this.context(storyId, actorId);
    if (!context || context.story.authorUserId === actorId) return;
    await this.notifications.create({
      userId: context.story.authorUserId,
      type: 'STORY_SCREENSHOT',
      title: 'Story screenshot',
      body: `${context.actor.displayName} captured your Story.`,
      data: { route: `/stories/${storyId}/viewers`, storyId, actorId }
    });
  }

  async mentions(storyId: string, authorId: string, targetUserIds: string[]) {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { displayName: true }
    });
    if (!author) return;
    const recipients = [...new Set(targetUserIds)].filter((id) => id !== authorId);
    await this.notifications.createMany(
      recipients.map((userId) => ({
        userId,
        type: 'STORY_MENTION',
        title: 'Mentioned in a Story',
        body: `${author.displayName} mentioned you in a Story.`,
        data: { route: `/stories/${storyId}`, storyId, actorId: authorId }
      }))
    );
  }

  private async context(storyId: string, actorId: string) {
    const [story, actor] = await Promise.all([
      this.prisma.story.findUnique({
        where: { id: storyId },
        select: { authorUserId: true }
      }),
      this.prisma.user.findUnique({
        where: { id: actorId },
        select: { displayName: true }
      })
    ]);
    return story && actor ? { story, actor } : null;
  }
}
