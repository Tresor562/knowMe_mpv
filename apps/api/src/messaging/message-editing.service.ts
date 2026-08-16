import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { EditMessageDto } from './dto/edit-message.dto';
import { StickerTokenService } from './stickers/sticker-token.service';

@Injectable()
export class MessageEditingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly stickerTokens: StickerTokenService
  ) {}

  async edit(
    userId: string,
    conversationId: string,
    messageId: string,
    dto: EditMessageDto
  ) {
    const current = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });
    if (!current) throw new NotFoundException('MESSAGE_EDIT_TARGET_NOT_FOUND');
    if (current.senderId !== userId) {
      throw new ForbiddenException('MESSAGE_EDIT_FORBIDDEN');
    }
    if (this.stickerTokens.resolve(current.content, { conversationId })) {
      throw new BadRequestException('MESSAGE_STICKER_EDIT_UNSUPPORTED');
    }

    const expected = dto.expectedEditedAt ? new Date(dto.expectedEditedAt) : null;
    const currentVersion = current.editedAt?.toISOString() ?? null;
    if ((expected?.toISOString() ?? null) !== currentVersion) {
      throw new ConflictException('MESSAGE_EDIT_VERSION_CONFLICT');
    }

    const editedAt = new Date();
    const updated = await this.prisma.message.updateMany({
      where: {
        id: messageId,
        conversationId,
        senderId: userId,
        editedAt: expected
      },
      data: { content: dto.content, editedAt }
    });
    if (updated.count !== 1) {
      throw new ConflictException('MESSAGE_EDIT_VERSION_CONFLICT');
    }

    const message = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });
    const presented = {
      ...message,
      presentation: {
        kind: 'TEXT' as const,
        text: message.content
      }
    };

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true }
    });
    const rooms = [
      `conversation:${conversationId}`,
      ...members.map((member) => `user:${member.userId}`)
    ];
    this.realtime.server.to(rooms).emit('message:updated', presented);

    return presented;
  }
}
