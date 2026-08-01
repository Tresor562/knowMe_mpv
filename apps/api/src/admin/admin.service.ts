import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async suspendUser(actorId: string, userId: string, suspended: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: suspended },
      select: { id: true, username: true, isSuspended: true }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: suspended ? 'USER_SUSPEND' : 'USER_RESTORE',
        entity: 'User',
        entityId: userId
      }
    });

    return updated;
  }
}
