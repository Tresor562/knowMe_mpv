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
    const locale = await this.locale(context.story.authorUserId);
    await this.notifications.create({
      userId: context.story.authorUserId,
      type: 'STORY_REACTION',
      title: locale === 'en' ? 'New Story reaction' : 'Nouvelle réaction à ta Story',
      body: locale === 'en'
        ? `${context.actor.displayName} reacted ${reaction} to your Story.`
        : `${context.actor.displayName} a réagi ${reaction} à ta Story.`,
      data: { route: `/stories/${storyId}`, storyId, actorId }
    });
  }

  async reply(storyId: string, actorId: string) {
    const context = await this.context(storyId, actorId);
    if (!context || context.story.authorUserId === actorId) return;
    const locale = await this.locale(context.story.authorUserId);
    await this.notifications.create({
      userId: context.story.authorUserId,
      type: 'STORY_REPLY',
      title: locale === 'en' ? 'New Story reply' : 'Nouvelle réponse à ta Story',
      body: locale === 'en'
        ? `${context.actor.displayName} replied to your Story.`
        : `${context.actor.displayName} a répondu à ta Story.`,
      data: { route: `/stories/${storyId}`, storyId, actorId }
    });
  }

  async screenshot(storyId: string, actorId: string) {
    const context = await this.context(storyId, actorId);
    if (!context || context.story.authorUserId === actorId) return;
    const locale = await this.locale(context.story.authorUserId);
    await this.notifications.create({
      userId: context.story.authorUserId,
      type: 'STORY_SCREENSHOT',
      title: locale === 'en' ? 'Story screenshot' : 'Capture de ta Story',
      body: locale === 'en'
        ? `${context.actor.displayName} captured your Story.`
        : `${context.actor.displayName} a effectué une capture de ta Story.`,
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
    await Promise.all(
      recipients.map(async (userId) => {
        const locale = await this.locale(userId);
        return this.notifications.create({
          userId,
          type: 'STORY_MENTION',
          title: locale === 'en' ? 'Mentioned in a Story' : 'Mention dans une Story',
          body: locale === 'en'
            ? `${author.displayName} mentioned you in a Story.`
            : `${author.displayName} t’a mentionné dans une Story.`,
          data: { route: `/stories/${storyId}`, storyId, actorId: authorId }
        });
      })
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

  private async locale(userId: string) {
    const preference = await this.prisma.userLocalePreference.findUnique({
      where: { userId },
      select: { locale: true }
    });
    return preference?.locale === 'en' ? 'en' : 'fr';
  }
}
