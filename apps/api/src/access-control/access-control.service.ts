import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  STAFF_ROLE_TO_ACCESS_ROLE,
  SYSTEM_ROLES
} from './access-control.catalog';
import { GrantRoleDto, RevokeRoleGrantDto } from './dto/access-control.dto';

@Injectable()
export class AccessControlService implements OnModuleInit {
  private catalogPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async onModuleInit() {
    await this.ensureCatalog();
  }

  ensureCatalog() {
    if (!this.catalogPromise) {
      this.catalogPromise = this.initializeCatalog().catch((error) => {
        this.catalogPromise = null;
        throw error;
      });
    }
    return this.catalogPromise;
  }

  async me(userId: string) {
    const access = await this.effectiveAccess(userId);
    return {
      accountId: userId,
      serverTime: new Date(),
      ...access
    };
  }

  async hasAll(userId: string, required: string[]) {
    const normalized = [...new Set(required.map(this.normalizeKey).filter(Boolean))];
    if (!normalized.length) return true;
    const access = await this.effectiveAccess(userId);
    const granted = new Set(access.permissions);
    return normalized.every((permission) => granted.has(permission));
  }

  async effectiveAccess(userId: string) {
    await this.ensureCatalog();
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        staffAccount: { select: { status: true } },
        accessRoleGrants: {
          where: this.activeGrantWhere(now),
          select: {
            id: true,
            source: true,
            startsAt: true,
            expiresAt: true,
            role: {
              select: {
                key: true,
                name: true,
                permissions: {
                  select: {
                    permission: { select: { key: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

    const permissions = new Set<string>();
    const roles = user.accessRoleGrants.map((grant) => {
      for (const relation of grant.role.permissions) {
        permissions.add(relation.permission.key);
      }
      return {
        grantId: grant.id,
        key: grant.role.key,
        name: grant.role.name,
        source: grant.source,
        startsAt: grant.startsAt,
        expiresAt: grant.expiresAt
      };
    });

    const activeStaff = user.staffAccount?.status === 'ACTIVE';
    const legacyAdmin = user.role === 'ADMIN' && !activeStaff;
    if (legacyAdmin) {
      for (const [permission] of PERMISSION_CATALOG) permissions.add(permission);
      roles.push({
        grantId: 'legacy-admin',
        key: 'legacy_admin',
        name: 'Legacy administrator',
        source: 'MIGRATION',
        startsAt: new Date(0),
        expiresAt: null
      });
    }

    return {
      roles,
      permissions: [...permissions].sort(),
      isAdministrative: permissions.size > 0
    };
  }

  async catalog() {
    await this.ensureCatalog();
    return this.prisma.accessRole.findMany({
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { key: 'asc' } }
        }
      },
      orderBy: { key: 'asc' }
    });
  }

  async listGrants(userId?: string) {
    await this.ensureCatalog();
    return this.prisma.userRoleGrant.findMany({
      where: userId ? { userId } : undefined,
      include: {
        role: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 300
    });
  }

  async grant(actorId: string, dto: GrantRoleDto) {
    await this.ensureCatalog();
    const roleKey = this.normalizeKey(dto.roleKey);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException(
        'La date d’expiration doit être postérieure au début du rôle.'
      );
    }

    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true }
      }),
      this.prisma.accessRole.findUnique({ where: { key: roleKey } })
    ]);

    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');
    if (!role) throw new NotFoundException('Rôle d’accès introuvable.');

    const duplicate = await this.prisma.userRoleGrant.findFirst({
      where: {
        userId: dto.userId,
        roleId: role.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
    if (duplicate) throw new ConflictException('Ce rôle est déjà actif pour ce compte.');

    const grant = await this.prisma.userRoleGrant.create({
      data: {
        userId: dto.userId,
        roleId: role.id,
        source: dto.source ?? 'ADMIN',
        externalReference: dto.externalReference?.trim() || null,
        startsAt,
        expiresAt,
        reason: dto.reason.trim(),
        grantedById: actorId
      },
      include: { role: true }
    });

    await this.audit.record({
      actorId,
      action: 'RBAC_ROLE_GRANT',
      entity: 'UserRoleGrant',
      entityId: grant.id,
      targetAccountId: dto.userId,
      metadata: {
        roleKey,
        source: grant.source,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
        reason: dto.reason.trim()
      }
    });

    return grant;
  }

  async revoke(actorId: string, grantId: string, dto: RevokeRoleGrantDto) {
    await this.ensureCatalog();
    const grant = await this.prisma.userRoleGrant.findUnique({
      where: { id: grantId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } }
          }
        }
      }
    });

    if (!grant) throw new NotFoundException('Attribution de rôle introuvable.');
    if (grant.revokedAt) return grant;

    const controlsRbac = grant.role.permissions.some(
      ({ permission }) => permission.key === PERMISSIONS.RBAC_MANAGE
    );
    if (grant.userId === actorId && controlsRbac) {
      throw new BadRequestException(
        'Vous ne pouvez pas révoquer votre propre rôle de gestion des accès.'
      );
    }

    const revoked = await this.prisma.userRoleGrant.update({
      where: { id: grant.id },
      data: {
        revokedAt: new Date(),
        revokedById: actorId,
        reason: dto.reason.trim()
      },
      include: { role: true }
    });

    await this.audit.record({
      actorId,
      action: 'RBAC_ROLE_REVOKE',
      entity: 'UserRoleGrant',
      entityId: grant.id,
      targetAccountId: grant.userId,
      metadata: {
        roleKey: grant.role.key,
        source: grant.source,
        reason: dto.reason.trim()
      }
    });

    return revoked;
  }

  private async initializeCatalog() {
    await this.prisma.$transaction(async (tx) => {
      const permissions = new Map<string, string>();
      for (const [key, description] of PERMISSION_CATALOG) {
        const permission = await tx.permission.upsert({
          where: { key },
          create: { key, description },
          update: { description }
        });
        permissions.set(key, permission.id);
      }

      for (const definition of SYSTEM_ROLES) {
        const role = await tx.accessRole.upsert({
          where: { key: definition.key },
          create: {
            key: definition.key,
            name: definition.name,
            description: definition.description,
            system: true
          },
          update: {
            name: definition.name,
            description: definition.description,
            system: true
          }
        });

        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await tx.rolePermission.createMany({
          data: definition.permissions.map((permissionKey) => ({
            roleId: role.id,
            permissionId: permissions.get(permissionKey)!
          })),
          skipDuplicates: true
        });
      }
    });

    await this.syncStaffRoleGrants();
  }

  private async syncStaffRoleGrants() {
    const activeStaff = await this.prisma.staffAccount.findMany({
      where: { status: 'ACTIVE', grantsAdminAccess: true },
      select: { id: true, userId: true, staffRole: true, activatedById: true, reason: true }
    });

    for (const staff of activeStaff) {
      const roleKey = STAFF_ROLE_TO_ACCESS_ROLE[staff.staffRole];
      if (!roleKey) continue;
      const role = await this.prisma.accessRole.findUnique({ where: { key: roleKey } });
      if (!role) continue;

      const existing = await this.prisma.userRoleGrant.findFirst({
        where: {
          userId: staff.userId,
          roleId: role.id,
          source: 'STAFF',
          externalReference: staff.id,
          revokedAt: null
        }
      });
      if (existing) continue;

      await this.prisma.userRoleGrant.create({
        data: {
          userId: staff.userId,
          roleId: role.id,
          source: 'STAFF',
          externalReference: staff.id,
          reason: staff.reason,
          grantedById: staff.activatedById
        }
      });
    }
  }

  private activeGrantWhere(now: Date) {
    return {
      startsAt: { lte: now },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    } satisfies Prisma.UserRoleGrantWhereInput;
  }

  private normalizeKey(value: string) {
    return value.trim().toLowerCase();
  }
}
