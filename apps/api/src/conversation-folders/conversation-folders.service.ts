import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationFolderDto } from './dto/create-conversation-folder.dto';
import { UpdateConversationFolderDto } from './dto/update-conversation-folder.dto';

@Injectable()
export class ConversationFoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [folders, memberships] = await Promise.all([
      this.prisma.conversationFolder.findMany({
        where: { userId },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }]
      }),
      this.prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true }
      })
    ]);
    const allowedConversationIds = new Set(
      memberships.map((membership) => membership.conversationId)
    );
    const assignments = folders.length
      ? await this.prisma.conversationFolderAssignment.findMany({
          where: { userId, folderId: { in: folders.map((folder) => folder.id) } },
          orderBy: [{ assignedAt: 'desc' }, { conversationId: 'asc' }]
        })
      : [];
    const staleAssignments = assignments.filter(
      (assignment) => !allowedConversationIds.has(assignment.conversationId)
    );
    if (staleAssignments.length) {
      await this.prisma.conversationFolderAssignment.deleteMany({
        where: {
          userId,
          conversationId: {
            in: staleAssignments.map((assignment) => assignment.conversationId)
          }
        }
      });
    }

    const visibleAssignments = assignments.filter((assignment) =>
      allowedConversationIds.has(assignment.conversationId)
    );
    return {
      items: folders.map((folder) => ({
        ...folder,
        conversationIds: visibleAssignments
          .filter((assignment) => assignment.folderId === folder.id)
          .map((assignment) => assignment.conversationId)
      }))
    };
  }

  async create(userId: string, dto: CreateConversationFolderDto) {
    const name = dto.name.trim();
    if (!name) throw new ConflictException('CONVERSATION_FOLDER_NAME_EMPTY');
    try {
      return await this.prisma.conversationFolder.create({
        data: {
          userId,
          name,
          normalizedName: this.normalizeName(name),
          position: dto.position ?? 0
        }
      });
    } catch (cause) {
      this.rethrowDuplicate(cause);
      throw cause;
    }
  }

  async update(userId: string, folderId: string, dto: UpdateConversationFolderDto) {
    await this.requireFolder(userId, folderId);
    const data: { name?: string; normalizedName?: string; position?: number } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new ConflictException('CONVERSATION_FOLDER_NAME_EMPTY');
      data.name = name;
      data.normalizedName = this.normalizeName(name);
    }
    if (dto.position !== undefined) data.position = dto.position;

    try {
      return await this.prisma.conversationFolder.update({
        where: { id: folderId },
        data
      });
    } catch (cause) {
      this.rethrowDuplicate(cause);
      throw cause;
    }
  }

  async remove(userId: string, folderId: string) {
    await this.requireFolder(userId, folderId);
    await this.prisma.conversationFolder.delete({ where: { id: folderId } });
    return { removed: true };
  }

  async assign(userId: string, folderId: string, conversationId: string) {
    await Promise.all([
      this.requireFolder(userId, folderId),
      this.requireConversationMembership(userId, conversationId)
    ]);
    return this.prisma.conversationFolderAssignment.upsert({
      where: { userId_conversationId: { userId, conversationId } },
      create: { userId, conversationId, folderId },
      update: { folderId, assignedAt: new Date() }
    });
  }

  async unassign(userId: string, conversationId: string) {
    const result = await this.prisma.conversationFolderAssignment.deleteMany({
      where: { userId, conversationId }
    });
    return { removed: result.count > 0 };
  }

  private async requireFolder(userId: string, folderId: string) {
    const folder = await this.prisma.conversationFolder.findFirst({
      where: { id: folderId, userId }
    });
    if (!folder) throw new NotFoundException('CONVERSATION_FOLDER_NOT_FOUND');
    return folder;
  }

  private async requireConversationMembership(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!membership) {
      throw new NotFoundException('CONVERSATION_FOLDER_TARGET_NOT_FOUND');
    }
  }

  private normalizeName(name: string) {
    return name.normalize('NFKC').trim().toLocaleLowerCase();
  }

  private rethrowDuplicate(cause: unknown): never | void {
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === 'P2002'
    ) {
      throw new ConflictException('CONVERSATION_FOLDER_NAME_CONFLICT');
    }
  }
}
