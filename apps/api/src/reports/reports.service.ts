import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  /** Dedicated private, paginated social report history; keeps `mine()` backwards compatible. */
  async minePostReports(reporterId: string, cursor?: string, status?: string) {
    if (status !== undefined &&
      (typeof status !== 'string' || !['OPEN', 'RESOLVED', 'DISMISSED'].includes(status))) {
      throw new BadRequestException('Statut de signalement invalide.');
    }
    const scope = { reporterId, targetType: 'POST', ...(status ? { status } : {}) };
    if (cursor !== undefined) {
      if (typeof cursor !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(cursor)) {
        throw new BadRequestException('Curseur de signalements invalide.');
      }
      // Never accept an anchor from another user's report or another report type.
      const anchor = await this.prisma.report.findFirst({
        where: { id: cursor, ...scope },
        select: { id: true }
      });
      if (!anchor) throw new BadRequestException('Curseur de signalements invalide.');
    }

    const PAGE_SIZE = 20;
    const entries = await this.prisma.report.findMany({
      where: scope,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true,
        resolvedAt: true
      }
    });
    return {
      reports: entries.slice(0, PAGE_SIZE),
      nextCursor: entries.length > PAGE_SIZE ? entries[PAGE_SIZE - 1].id : null
    };
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
