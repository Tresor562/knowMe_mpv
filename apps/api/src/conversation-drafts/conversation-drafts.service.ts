import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveConversationDraftDto } from './dto/save-conversation-draft.dto';

@Injectable()
export class ConversationDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const drafts = await this.prisma.conversationDraft.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { conversationId: 'asc' }],
      take: 100
    });
    if (!drafts.length) return { items: [] };

    const memberships = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        conversationId: { in: drafts.map((draft) => draft.conversationId) }
      },
      select: { conversationId: true }
    });
    const allowed = new Set(memberships.map((membership) => membership.conversationId));
    const staleIds = drafts
      .filter((draft) => !allowed.has(draft.conversationId))
      .map((draft) => draft.conversationId);

    if (staleIds.length) {
      await this.prisma.conversationDraft.deleteMany({
        where: { userId, conversationId: { in: staleIds } }
      });
    }

    return {
      items: drafts.filter((draft) => allowed.has(draft.conversationId))
    };
  }

  async save(
    userId: string,
    conversationId: string,
    dto: SaveConversationDraftDto
  ) {
    await this.assertMember(userId, conversationId);

    const existing = await this.prisma.conversationDraft.findUnique({
      where: { userId_conversationId: { userId, conversationId } }
    });

    if (!existing) {
      if (dto.expectedVersion !== undefined && dto.expectedVersion !== 0) {
        throw new ConflictException('CONVERSATION_DRAFT_VERSION_CONFLICT');
      }
      try {
        return await this.prisma.conversationDraft.create({
          data: { userId, conversationId, content: dto.content }
        });
      } catch (cause) {
        if (
          cause instanceof Prisma.PrismaClientKnownRequestError &&
          cause.code === 'P2002'
        ) {
          throw new ConflictException('CONVERSATION_DRAFT_VERSION_CONFLICT');
        }
        throw cause;
      }
    }

    if (
      dto.expectedVersion !== undefined &&
      dto.expectedVersion !== existing.version
    ) {
      throw new ConflictException('CONVERSATION_DRAFT_VERSION_CONFLICT');
    }

    const updated = await this.prisma.conversationDraft.updateMany({
      where: {
        userId,
        conversationId,
        version: existing.version
      },
      data: {
        content: dto.content,
        version: { increment: 1 }
      }
    });
    if (updated.count !== 1) {
      throw new ConflictException('CONVERSATION_DRAFT_VERSION_CONFLICT');
    }

    return this.prisma.conversationDraft.findUniqueOrThrow({
      where: { userId_conversationId: { userId, conversationId } }
    });
  }

  async remove(userId: string, conversationId: string) {
    const result = await this.prisma.conversationDraft.deleteMany({
      where: { userId, conversationId }
    });
    return { removed: result.count > 0 };
  }

  private async assertMember(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!membership) {
      throw new NotFoundException('CONVERSATION_DRAFT_TARGET_NOT_FOUND');
    }
  }
}
