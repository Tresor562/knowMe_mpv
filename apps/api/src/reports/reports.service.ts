import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    await this.ensureTargetExists(dto.targetType, dto.targetId);

    const duplicate = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: 'OPEN'
      }
    });

    if (duplicate) {
      throw new ConflictException('Un signalement ouvert existe déjà pour cette cible.');
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason.trim()
      },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true
      }
    });
  }

  mine(reporterId: string) {
    return this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  private async ensureTargetExists(targetType: string, targetId: string) {
    const exists = await (async () => {
      switch (targetType) {
        case 'USER':
          return this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
        case 'POST':
          return this.prisma.post.findUnique({ where: { id: targetId }, select: { id: true } });
        case 'COMMENT':
          return this.prisma.postComment.findUnique({ where: { id: targetId }, select: { id: true } });
        case 'MESSAGE':
          return this.prisma.message.findUnique({ where: { id: targetId }, select: { id: true } });
        case 'CHALLENGE':
          return this.prisma.challenge.findUnique({ where: { id: targetId }, select: { id: true } });
        default:
          return null;
      }
    })();

    if (!exists) {
      throw new NotFoundException('La cible du signalement est introuvable.');
    }
  }
}
