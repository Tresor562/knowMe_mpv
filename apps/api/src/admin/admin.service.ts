import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  dashboard() {
    return this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.challenge.count(),
      this.prisma.report.count({ where: { status: 'OPEN' } })
    ]).then(([users, posts, challenges, openReports]) => ({
      users, posts, challenges, openReports
    }));
  }

  listReports(status = 'OPEN') {
    return this.prisma.report.findMany({
      where: status === 'ALL' ? undefined : { status },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async resolveReport(actorId: string, reportId: string, status: string) {
    if (!['RESOLVED', 'DISMISSED'].includes(status)) {
      throw new BadRequestException('Statut de résolution invalide.');
    }

    const report = await this.prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new NotFoundException('Signalement introuvable.');
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolvedAt: new Date()
      }
    });

    await this.audit.record({
      actorId,
      action: status === 'RESOLVED' ? 'REPORT_RESOLVE' : 'REPORT_DISMISS',
      entity: 'Report',
      entityId: reportId,
      metadata: {
        targetType: report.targetType,
        targetId: report.targetId
      }
    });

    return updated;
  }

  listAuditLogs(requestId?: string, correlationId?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(requestId ? { requestId } : {}),
        ...(correlationId ? { correlationId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async suspendUser(actorId: string, userId: string, suspended: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: suspended },
      select: { id: true, username: true, isSuspended: true }
    });

    if (suspended) {
      await this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await this.audit.record({
      actorId,
      action: suspended ? 'USER_SUSPEND' : 'USER_RESTORE',
      entity: 'User',
      entityId: userId,
      targetAccountId: userId
    });

    return updated;
  }
}
