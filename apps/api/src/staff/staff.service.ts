import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivateStaffAccountDto,
  UpdateStaffAccountStatusDto
} from './dto/staff-account.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list() {
    return this.prisma.staffAccount.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            role: true
          }
        }
      },
      orderBy: [{ status: 'asc' }, { activatedAt: 'desc' }],
      take: 200
    });
  }

  async activate(actorId: string, dto: ActivateStaffAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        role: true,
        staffAccount: true
      }
    });

    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');
    if (user.staffAccount?.status === 'ACTIVE') {
      throw new ConflictException('Ce compte appartient déjà à l’équipe KnowMe.');
    }

    const grantsAdminAccess = dto.grantsAdminAccess ?? true;
    const now = new Date();
    const previousUserRole = user.role;

    const staff = await this.prisma.$transaction(async (tx) => {
      const record = await tx.staffAccount.upsert({
        where: { userId: dto.userId },
        create: {
          userId: dto.userId,
          staffRole: dto.staffRole,
          status: 'ACTIVE',
          grantsAdminAccess,
          previousUserRole,
          reason: dto.reason.trim(),
          activatedById: actorId,
          activatedAt: now
        },
        update: {
          staffRole: dto.staffRole,
          status: 'ACTIVE',
          grantsAdminAccess,
          previousUserRole,
          reason: dto.reason.trim(),
          activatedById: actorId,
          activatedAt: now,
          suspendedAt: null,
          revokedAt: null,
          revokedById: null
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true
            }
          }
        }
      });

      if (grantsAdminAccess && user.role !== 'ADMIN') {
        await tx.user.update({
          where: { id: dto.userId },
          data: { role: 'ADMIN' }
        });
      }

      return record;
    });

    await this.audit.record({
      actorId,
      action: 'STAFF_ACCOUNT_ACTIVATE',
      entity: 'StaffAccount',
      entityId: staff.id,
      targetAccountId: dto.userId,
      metadata: {
        staffRole: dto.staffRole,
        grantsAdminAccess,
        reason: dto.reason.trim()
      }
    });

    return this.getById(staff.id);
  }

  async updateStatus(
    actorId: string,
    staffId: string,
    dto: UpdateStaffAccountStatusDto
  ) {
    const current = await this.prisma.staffAccount.findUnique({
      where: { id: staffId },
      include: { user: { select: { id: true, role: true } } }
    });
    if (!current) throw new NotFoundException('Compte staff introuvable.');

    if (current.userId === actorId && dto.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Vous ne pouvez pas suspendre ou révoquer votre propre compte staff.'
      );
    }

    if (current.status === dto.status) {
      throw new ConflictException(`Ce compte est déjà au statut ${dto.status}.`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.staffAccount.update({
        where: { id: staffId },
        data: {
          status: dto.status,
          reason: dto.reason.trim(),
          suspendedAt: dto.status === 'SUSPENDED' ? now : null,
          revokedAt: dto.status === 'REVOKED' ? now : null,
          revokedById: dto.status === 'REVOKED' ? actorId : null,
          ...(dto.status === 'ACTIVE'
            ? {
                activatedById: actorId,
                activatedAt: now,
                previousUserRole:
                  current.status === 'ACTIVE'
                    ? current.previousUserRole
                    : current.user.role
              }
            : {})
        }
      });

      const desiredRole =
        dto.status === 'ACTIVE' && current.grantsAdminAccess
          ? 'ADMIN'
          : current.previousUserRole;

      if (current.user.role !== desiredRole) {
        await tx.user.update({
          where: { id: current.userId },
          data: { role: desiredRole }
        });
      }

      if (dto.status !== 'ACTIVE') {
        await tx.authSession.updateMany({
          where: { userId: current.userId, revokedAt: null },
          data: { revokedAt: now }
        });
      }

      return staff;
    });

    await this.audit.record({
      actorId,
      action: `STAFF_ACCOUNT_${dto.status}`,
      entity: 'StaffAccount',
      entityId: current.id,
      targetAccountId: current.userId,
      metadata: {
        previousStatus: current.status,
        status: dto.status,
        staffRole: current.staffRole,
        reason: dto.reason.trim()
      }
    });

    return this.getById(updated.id);
  }

  private async getById(id: string) {
    const staff = await this.prisma.staffAccount.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });
    if (!staff) throw new NotFoundException('Compte staff introuvable.');
    return staff;
  }
}
