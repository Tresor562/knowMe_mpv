import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProfileCircleJoinRequestDto,
  ProfileCircleLifecycleDto,
  RemoveProfileCircleMemberDto,
  ReviewProfileCircleJoinRequestDto,
  UpdateProfileCircleDto
} from './dto/profile-circle.dto';
import {
  canViewProfileCircle,
  circleLevelFromXp,
  ProfileCircleActivityType,
  transitionCircleStatus,
  validateCircleActivity,
  validateCircleJoinRequest
} from './profile-circle.domain';
import {
  circleLimits,
  ProfileCircleType,
  validateProfileCircle
} from './profile-experience.domain';

@Injectable()
export class ProfileCircleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async mine(userId: string) {
    const memberships = await this.prisma.profileCircleMember.findMany({
      where: {
        userId,
        status: { in: ['INVITED', 'ACTIVE'] }
      },
      include: {
        circle: {
          include: {
            _count: {
              select: {
                members: true,
                joinRequests: true,
                activities: true
              }
            }
          }
        }
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }]
    });

    return memberships.map((membership) => ({
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
        consentedAt: membership.consentedAt
      },
      circle: {
        ...membership.circle,
        progression: circleLevelFromXp(membership.circle.xp)
      },
      capabilities: {
        accept: membership.status === 'INVITED',
        decline: membership.status === 'INVITED',
        leave:
          membership.status === 'ACTIVE' &&
          membership.circle.ownerUserId !== userId,
        manage:
          membership.circle.ownerUserId === userId ||
          ['OWNER', 'ADMIN', 'OFFICER'].includes(membership.role)
      }
    }));
  }

  async publicSnapshot(slug: string, viewerId: string | null) {
    const circle = await this.prisma.profileCircle.findUnique({
      where: { slug },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          orderBy: [{ portraitPosition: 'asc' }, { joinedAt: 'asc' }]
        },
        activities: {
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 30
        }
      }
    });
    if (!circle) throw new NotFoundException('Profil collectif introuvable.');

    const viewerMembership = viewerId
      ? circle.members.find((entry) => entry.userId === viewerId) ?? null
      : null;
    const viewerIsMember = Boolean(viewerMembership);
    const viewerIsFriendOfOwner = viewerId
      ? await this.areFriends(viewerId, circle.ownerUserId)
      : false;
    const access = canViewProfileCircle({
      visibility: circle.visibility,
      viewerIsMember,
      viewerIsFriendOfOwner,
      viewerIsFollowerOfOwner: false
    });

    if (!access.visible || (circle.status !== 'ACTIVE' && !viewerIsMember)) {
      throw new NotFoundException('Profil collectif introuvable.');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: circle.members.map((entry) => entry.userId) } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return {
      circle: {
        id: circle.id,
        type: circle.type,
        name: circle.name,
        slug: circle.slug,
        status: circle.status,
        bannerAssetId: circle.bannerAssetId,
        emblemAssetId: circle.emblemAssetId,
        accentColor: circle.accentColor,
        sharedBio: circle.sharedBio,
        animationKey: circle.animationKey,
        visibility: circle.visibility,
        joinable: circle.joinable,
        createdAt: circle.createdAt
      },
      progression: circleLevelFromXp(circle.xp),
      members: circle.members.map((membership) => ({
        role: membership.role,
        bioFragment: membership.bioFragment,
        portraitPosition: membership.portraitPosition,
        joinedAt: membership.joinedAt,
        user: userMap.get(membership.userId) ?? {
          id: membership.userId,
          username: 'indisponible',
          displayName: 'Membre indisponible',
          avatarUrl: null
        }
      })),
      recentActivity: circle.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        xpAwarded: activity.xpAwarded,
        occurredAt: activity.occurredAt
      })),
      viewer: {
        member: viewerIsMember,
        role: viewerMembership?.role ?? null,
        accessReason: access.reason,
        canRequestJoin:
          Boolean(viewerId) &&
          !viewerIsMember &&
          circle.type === 'GUILD' &&
          circle.status === 'ACTIVE' &&
          circle.joinable &&
          circle.members.length < circle.maxMembers,
        canManage:
          viewerId === circle.ownerUserId ||
          ['OWNER', 'ADMIN', 'OFFICER'].includes(viewerMembership?.role ?? '')
      },
      privacy: {
        inactiveMembersOmitted: true,
        pendingInvitationsOmitted: true,
        joinRequestsOmitted: true,
        memberPrivateDataOmitted: true,
        serverResolved: true
      }
    };
  }

  async update(userId: string, circleId: string, dto: UpdateProfileCircleDto) {
    const circle = await this.requireManager(userId, circleId, true);
    if (circle.status === 'ENDED') {
      throw new ConflictException('Une relation terminée ne peut plus être modifiée.');
    }
    if (dto.joinable === true && circle.type !== 'GUILD') {
      throw new BadRequestException('Seules les guildes peuvent être ouvertes aux adhésions.');
    }

    const updated = await this.prisma.profileCircle.update({
      where: { id: circleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sharedBio !== undefined
          ? { sharedBio: dto.sharedBio?.trim() || null }
          : {}),
        ...(dto.bannerAssetId !== undefined
          ? { bannerAssetId: dto.bannerAssetId || null }
          : {}),
        ...(dto.emblemAssetId !== undefined
          ? { emblemAssetId: dto.emblemAssetId || null }
          : {}),
        ...(dto.animationKey !== undefined
          ? { animationKey: dto.animationKey || null }
          : {}),
        ...(dto.accentColor !== undefined
          ? { accentColor: dto.accentColor }
          : {}),
        ...(dto.visibility !== undefined
          ? { visibility: dto.visibility as never }
          : {}),
        ...(dto.joinable !== undefined ? { joinable: dto.joinable } : {})
      }
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_UPDATED',
      entity: 'ProfileCircle',
      entityId: circleId,
      targetAccountId: circle.ownerUserId,
      metadata: {
        type: circle.type,
        visibility: updated.visibility,
        joinable: updated.joinable
      }
    });
    return updated;
  }

  async declineInvitation(userId: string, circleId: string) {
    const membership = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
      include: { circle: true }
    });
    if (!membership || membership.status !== 'INVITED') {
      throw new NotFoundException('Invitation active introuvable.');
    }

    const limits = circleLimits(membership.circle.type as ProfileCircleType);
    const remaining = await this.prisma.profileCircleMember.count({
      where: {
        circleId,
        userId: { not: userId },
        status: { in: ['INVITED', 'ACTIVE'] }
      }
    });
    const shouldEnd =
      membership.circle.type.startsWith('DUO_') ||
      remaining < limits.minimumMembers;

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.profileCircleMember.update({
        where: { id: membership.id },
        data: {
          status: 'DECLINED',
          leftAt: new Date()
        }
      });
      if (shouldEnd) {
        await tx.profileCircle.update({
          where: { id: circleId },
          data: { status: 'ENDED' }
        });
      }
      return member;
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_INVITATION_DECLINED',
      entity: 'ProfileCircle',
      entityId: circleId,
      targetAccountId: userId,
      metadata: { relationEnded: shouldEnd, unanimousConsentRequired: limits.requiresUnanimousConsent }
    });
    return { membership: result, relationEnded: shouldEnd };
  }

  async leave(userId: string, circleId: string) {
    const membership = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
      include: { circle: true }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Participation active introuvable.');
    }
    if (membership.circle.ownerUserId === userId) {
      throw new ConflictException(
        'Le propriétaire doit transférer la propriété ou terminer la relation.'
      );
    }

    const activeAfter = Math.max(
      0,
      (await this.prisma.profileCircleMember.count({
        where: { circleId, status: 'ACTIVE' }
      })) - 1
    );
    const limits = circleLimits(membership.circle.type as ProfileCircleType);
    const nextStatus =
      membership.circle.type.startsWith('DUO_') ||
      activeAfter < limits.minimumMembers
        ? 'ENDED'
        : limits.requiresUnanimousConsent
          ? 'PAUSED'
          : membership.circle.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.profileCircleMember.update({
        where: { id: membership.id },
        data: { status: 'LEFT', leftAt: new Date() }
      });
      if (nextStatus !== membership.circle.status) {
        await tx.profileCircle.update({
          where: { id: circleId },
          data: { status: nextStatus as never }
        });
      }
      return member;
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_LEFT',
      entity: 'ProfileCircle',
      entityId: circleId,
      targetAccountId: userId,
      metadata: { nextStatus, activeMembers: activeAfter }
    });
    return { membership: result, circleStatus: nextStatus };
  }

  async lifecycle(
    userId: string,
    circleId: string,
    dto: ProfileCircleLifecycleDto
  ) {
    const circle = await this.requireManager(userId, circleId, true);
    const nextStatus = transitionCircleStatus({
      currentStatus: circle.status,
      action: dto.action,
      actorIsOwner: circle.ownerUserId === userId
    });

    if (nextStatus === 'ACTIVE') {
      const activeMembers = await this.prisma.profileCircleMember.count({
        where: { circleId, status: 'ACTIVE' }
      });
      validateProfileCircle({
        type: circle.type as ProfileCircleType,
        memberCount: activeMembers,
        activeConsents: activeMembers,
        level: circle.level,
        xp: circle.xp
      });
    }

    const updated = await this.prisma.profileCircle.update({
      where: { id: circleId },
      data: { status: nextStatus as never }
    });
    await this.audit.record({
      actorId: userId,
      action: `PROFILE_CIRCLE_${dto.action}`,
      entity: 'ProfileCircle',
      entityId: circleId,
      targetAccountId: circle.ownerUserId,
      metadata: {
        previousStatus: circle.status,
        nextStatus,
        reason: dto.reason?.trim() || null
      }
    });
    return updated;
  }

  async requestJoin(
    userId: string,
    circleId: string,
    dto: CreateProfileCircleJoinRequestDto
  ) {
    const circle = await this.prisma.profileCircle.findUnique({
      where: { id: circleId }
    });
    if (!circle) throw new NotFoundException('Guilde introuvable.');

    const [memberCount, membership] = await Promise.all([
      this.prisma.profileCircleMember.count({
        where: { circleId, status: 'ACTIVE' }
      }),
      this.prisma.profileCircleMember.findUnique({
        where: { circleId_userId: { circleId, userId } }
      })
    ]);
    try {
      validateCircleJoinRequest({
        type: circle.type,
        status: circle.status,
        joinable: circle.joinable,
        memberCount,
        maximumMembers: circle.maxMembers,
        alreadyMember: Boolean(
          membership && ['ACTIVE', 'INVITED'].includes(membership.status)
        )
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Demande d’adhésion invalide.'
      );
    }

    const request = await this.prisma.profileCircleJoinRequest.upsert({
      where: { circleId_userId: { circleId, userId } },
      create: {
        circleId,
        userId,
        message: dto.message?.trim() || null
      },
      update: {
        message: dto.message?.trim() || null,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null
      }
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_JOIN_REQUESTED',
      entity: 'ProfileCircleJoinRequest',
      entityId: request.id,
      targetAccountId: circle.ownerUserId,
      metadata: { circleId }
    });
    return request;
  }

  async joinRequests(userId: string, circleId: string) {
    await this.requireManager(userId, circleId, false);
    const requests = await this.prisma.profileCircleJoinRequest.findMany({
      where: { circleId, status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: requests.map((request) => request.userId) } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    return requests.map((request) => ({
      ...request,
      applicant: userMap.get(request.userId) ?? null
    }));
  }

  async reviewJoinRequest(
    userId: string,
    circleId: string,
    requestId: string,
    dto: ReviewProfileCircleJoinRequestDto
  ) {
    const circle = await this.requireManager(userId, circleId, false);
    const request = await this.prisma.profileCircleJoinRequest.findUnique({
      where: { id: requestId }
    });
    if (!request || request.circleId !== circleId || request.status !== 'PENDING') {
      throw new NotFoundException('Demande d’adhésion active introuvable.');
    }

    if (dto.action === 'DECLINE') {
      const declined = await this.prisma.profileCircleJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'DECLINED',
          reviewedById: userId,
          reviewedAt: new Date()
        }
      });
      await this.audit.record({
        actorId: userId,
        action: 'PROFILE_CIRCLE_JOIN_DECLINED',
        entity: 'ProfileCircleJoinRequest',
        entityId: requestId,
        targetAccountId: request.userId,
        metadata: { circleId, reason: dto.reason?.trim() || null }
      });
      return declined;
    }

    const memberCount = await this.prisma.profileCircleMember.count({
      where: { circleId, status: 'ACTIVE' }
    });
    if (memberCount >= circle.maxMembers) {
      throw new ConflictException('La guilde a atteint sa capacité maximale.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.profileCircleJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedById: userId,
          reviewedAt: new Date()
        }
      });
      const membership = await tx.profileCircleMember.upsert({
        where: {
          circleId_userId: { circleId, userId: request.userId }
        },
        create: {
          circleId,
          userId: request.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
          consentedAt: new Date(),
          joinedAt: new Date()
        },
        update: {
          role: 'MEMBER',
          status: 'ACTIVE',
          consentedAt: new Date(),
          joinedAt: new Date(),
          leftAt: null
        }
      });
      return { reviewed, membership };
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_JOIN_APPROVED',
      entity: 'ProfileCircleJoinRequest',
      entityId: requestId,
      targetAccountId: request.userId,
      metadata: { circleId }
    });
    return result;
  }

  async removeMember(
    userId: string,
    circleId: string,
    memberUserId: string,
    dto: RemoveProfileCircleMemberDto
  ) {
    const circle = await this.requireManager(userId, circleId, false);
    if (memberUserId === circle.ownerUserId) {
      throw new ConflictException('Le propriétaire ne peut pas être retiré.');
    }
    const membership = await this.prisma.profileCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: memberUserId }
      }
    });
    if (!membership || !['ACTIVE', 'INVITED'].includes(membership.status)) {
      throw new NotFoundException('Membre actif ou invité introuvable.');
    }

    const limits = circleLimits(circle.type as ProfileCircleType);
    const nextStatus = circle.type.startsWith('DUO_')
      ? 'ENDED'
      : limits.requiresUnanimousConsent && circle.status === 'ACTIVE'
        ? 'PAUSED'
        : circle.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.profileCircleMember.update({
        where: { id: membership.id },
        data: { status: 'REMOVED', leftAt: new Date() }
      });
      if (nextStatus !== circle.status) {
        await tx.profileCircle.update({
          where: { id: circleId },
          data: { status: nextStatus as never }
        });
      }
      return member;
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_MEMBER_REMOVED',
      entity: 'ProfileCircle',
      entityId: circleId,
      targetAccountId: memberUserId,
      metadata: {
        nextStatus,
        reason: dto.reason?.trim() || null
      }
    });
    return { membership: result, circleStatus: nextStatus };
  }

  async recordActivity(input: {
    circleId: string;
    actorUserId?: string | null;
    type: ProfileCircleActivityType;
    xpAwarded: number;
    sourceType?: string | null;
    sourceId?: string | null;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }) {
    validateCircleActivity(input);
    const existing = await this.prisma.profileCircleActivityEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      const circle = await this.prisma.profileCircle.findUnique({
        where: { id: existing.circleId }
      });
      return {
        event: existing,
        replayed: true,
        progression: circle ? circleLevelFromXp(circle.xp) : null
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const circle = await tx.profileCircle.findUnique({
          where: { id: input.circleId }
        });
        if (!circle || circle.status !== 'ACTIVE') {
          throw new ConflictException('Le profil collectif doit être actif pour gagner de l’XP.');
        }
        const event = await tx.profileCircleActivityEvent.create({
          data: {
            circleId: input.circleId,
            actorUserId: input.actorUserId ?? null,
            type: input.type as never,
            xpAwarded: input.xpAwarded,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata as Prisma.InputJsonValue | undefined,
            occurredAt: input.occurredAt ?? new Date()
          }
        });
        const incremented = await tx.profileCircle.update({
          where: { id: input.circleId },
          data: { xp: { increment: input.xpAwarded } }
        });
        const progression = circleLevelFromXp(incremented.xp);
        if (incremented.level !== progression.level) {
          await tx.profileCircle.update({
            where: { id: input.circleId },
            data: { level: progression.level }
          });
        }
        return { event, replayed: false, progression };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.profileCircleActivityEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey }
        });
        if (replay) {
          const circle = await this.prisma.profileCircle.findUnique({
            where: { id: replay.circleId }
          });
          return {
            event: replay,
            replayed: true,
            progression: circle ? circleLevelFromXp(circle.xp) : null
          };
        }
      }
      throw error;
    }
  }

  private async requireManager(
    userId: string,
    circleId: string,
    ownerOnly: boolean
  ) {
    const circle = await this.prisma.profileCircle.findUnique({
      where: { id: circleId }
    });
    if (!circle) throw new NotFoundException('Profil collectif introuvable.');
    if (circle.ownerUserId === userId) return circle;
    if (ownerOnly) throw new ForbiddenException('Action réservée au propriétaire.');

    const membership = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } }
    });
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      !['OWNER', 'ADMIN', 'OFFICER'].includes(membership.role)
    ) {
      throw new ForbiddenException('Permission de gestion collective insuffisante.');
    }
    return circle;
  }

  private async areFriends(firstUserId: string, secondUserId: string) {
    return Boolean(
      await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: firstUserId, addresseeId: secondUserId },
            { requesterId: secondUserId, addresseeId: firstUserId }
          ]
        },
        select: { id: true }
      })
    );
  }
}
