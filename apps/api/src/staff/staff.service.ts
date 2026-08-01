import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AccessControlService } from '../access-control/access-control.service';
import { STAFF_ROLE_TO_ACCESS_ROLE } from '../access-control/access-control.catalog';
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
    private readonly audit: AuditService,
    private readonly access: AccessControlService
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
    await this.access.ensureCatalog();
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
    const accessRoleKey = STAFF_ROLE_TO_ACCESS_ROLE[dto.staffRole];
    const accessRole = grantsAdminAccess
      ? await this.prisma.accessRole.findUnique({ where: { key: accessRoleKey } })
      : null;
    if (grantsAdminAccess && !accessRole) {
      throw new BadRequestException('Rôle d’accès staff introuvable.');
    }

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
        }
      });

      await tx.userRoleGrant.updateMany({
        where: {
          userId: dto.userId,
          source: 'STAFF',
          revokedAt: null
        },
        data: { revokedAt: now, revokedById: actorId }
      });

      if (accessRole) {
        await tx.userRoleGrant.create({
          data: {
            userId: dto.userId,
            roleId: accessRole.id,
            source: 'STAFF',
            externalReference: record.id,
            reason: dto.reason.trim(),
            grantedById: actorId
          }
        });
      }

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
        accessRoleKey: accessRole?.key ?? null,
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
    await this.access.ensureCatalog();
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

    const accessRoleKey = STAFF_ROLE_TO_ACCESS_ROLE[current.staffRole];
    const accessRole =
      dto.status === 'ACTIVE' && current.grantsAdminAccess
        ? await this.prisma.accessRole.findUnique({ where: { key: accessRoleKey } })
        : null;
    if (dto.status === 'ACTIVE' && current.grantsAdminAccess && !accessRole) {
      throw new BadRequestException('Rôle d’accès staff introuvable.');
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

      await tx.userRoleGrant.updateMany({
        where: {
          userId: current.userId,
          source: 'STAFF',
          revokedAt: null
        },
        data: { revokedAt: now, revokedById: actorId }
      });

      if (dto.status === 'ACTIVE' && accessRole) {
        await tx.userRoleGrant.create({
          data: {
            userId: current.userId,
            roleId: accessRole.id,
            source: 'STAFF',
            externalReference: staff.id,
            reason: dto.reason.trim(),
            grantedById: actorId
          }
        });
      }

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
        accessRoleKey: accessRole?.key ?? null,
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
