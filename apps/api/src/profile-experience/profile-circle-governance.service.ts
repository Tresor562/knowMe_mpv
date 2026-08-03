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
  CreateProfileCircleMomentDto,
  CreateProfileCircleOwnershipTransferDto,
  CreateProfileCircleStoryDto,
  CreateProfileFamilyRelationDto,
  ModerateProfileCircleContentDto,
  ProfileFamilyRelationActionDto,
  UpdateProfileCircleRoleDto
} from './dto/profile-circle-governance.dto';
import {
  circleStoryDurationPolicy,
  familyRelationPairKey,
  inverseFamilyRelationType,
  ProfileCirclePermission,
  ProfileFamilyRelationType,
  resolveCircleContentInitialStatus,
  roleHasCirclePermission,
  validateCircleRoleChange,
  validateFamilyRelationProposal,
  validateOwnershipTransfer
} from './profile-circle-governance.domain';
import { ProfileCircleService } from './profile-circle.service';

@Injectable()
export class ProfileCircleGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly circles: ProfileCircleService
  ) {}

  async updateRole(
    actorUserId: string,
    circleId: string,
    targetUserId: string,
    dto: UpdateProfileCircleRoleDto
  ) {
    const { circle, membership: actorMembership } = await this.requirePermission(
      actorUserId,
      circleId,
      'MANAGE_ROLES'
    );
    const target = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId: targetUserId } }
    });
    if (!target || target.status !== 'ACTIVE') {
      throw new NotFoundException('Membre actif introuvable.');
    }

    try {
      validateCircleRoleChange({
        actorRole:
          circle.ownerUserId === actorUserId ? 'OWNER' : actorMembership.role,
        targetIsOwner: circle.ownerUserId === targetUserId,
        nextRole: dto.role,
        circleType: circle.type
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Modification de rôle invalide.'
      );
    }

    const updated = await this.prisma.profileCircleMember.update({
      where: { id: target.id },
      data: { role: dto.role }
    });
    await this.audit.record({
      actorId: actorUserId,
      action: 'PROFILE_CIRCLE_ROLE_UPDATED',
      entity: 'ProfileCircleMember',
      entityId: target.id,
      targetAccountId: targetUserId,
      metadata: {
        circleId,
        previousRole: target.role,
        nextRole: dto.role
      }
    });
    return updated;
  }

  async createOwnershipTransfer(
    actorUserId: string,
    circleId: string,
    dto: CreateProfileCircleOwnershipTransferDto
  ) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (dto.expiresInHours ?? 72) * 60 * 60 * 1000
    );

    await this.prisma.profileCircleOwnershipTransfer.updateMany({
      where: {
        circleId,
        status: 'PENDING',
        expiresAt: { lte: now }
      },
      data: { status: 'EXPIRED' }
    });

    const transfer = await this.prisma.$transaction(
      async (tx) => {
        const circle = await tx.profileCircle.findUnique({
          where: { id: circleId }
        });
        if (!circle) throw new NotFoundException('Profil collectif introuvable.');
        const [target, pending] = await Promise.all([
          tx.profileCircleMember.findUnique({
            where: {
              circleId_userId: { circleId, userId: dto.toUserId }
            }
          }),
          tx.profileCircleOwnershipTransfer.findFirst({
            where: {
              circleId,
              status: 'PENDING',
              expiresAt: { gt: now }
            }
          })
        ]);

        try {
          validateOwnershipTransfer({
            actorIsCurrentOwner: circle.ownerUserId === actorUserId,
            targetIsActiveMember: target?.status === 'ACTIVE',
            targetIsCurrentOwner: circle.ownerUserId === dto.toUserId,
            pendingTransferExists: Boolean(pending),
            expiresAt,
            now
          });
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Transfert invalide.'
          );
        }

        return tx.profileCircleOwnershipTransfer.create({
          data: {
            circleId,
            fromUserId: actorUserId,
            toUserId: dto.toUserId,
            reason: dto.reason?.trim() || null,
            expiresAt
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.audit.record({
      actorId: actorUserId,
      action: 'PROFILE_CIRCLE_OWNERSHIP_TRANSFER_CREATED',
      entity: 'ProfileCircleOwnershipTransfer',
      entityId: transfer.id,
      targetAccountId: dto.toUserId,
      metadata: { circleId, expiresAt: expiresAt.toISOString() }
    });
    return transfer;
  }

  async transfersForMe(userId: string) {
    const now = new Date();
    await this.prisma.profileCircleOwnershipTransfer.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
        OR: [{ fromUserId: userId }, { toUserId: userId }]
      },
      data: { status: 'EXPIRED' }
    });
    const transfers = await this.prisma.profileCircleOwnershipTransfer.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }]
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    const circles = await this.prisma.profileCircle.findMany({
      where: { id: { in: transfers.map((entry) => entry.circleId) } },
      select: { id: true, name: true, slug: true, type: true, status: true }
    });
    const circleMap = new Map(circles.map((circle) => [circle.id, circle]));
    return transfers.map((transfer) => ({
      ...transfer,
      circle: circleMap.get(transfer.circleId) ?? null,
      capabilities: {
        accept:
          transfer.toUserId === userId &&
          transfer.status === 'PENDING' &&
          transfer.expiresAt > now,
        cancel:
          [transfer.fromUserId, transfer.toUserId].includes(userId) &&
          transfer.status === 'PENDING'
      }
    }));
  }

  async acceptOwnershipTransfer(userId: string, transferId: string) {
    const now = new Date();
    const result = await this.prisma.$transaction(
      async (tx) => {
        const transfer = await tx.profileCircleOwnershipTransfer.findUnique({
          where: { id: transferId }
        });
        if (!transfer || transfer.toUserId !== userId) {
          throw new NotFoundException('Transfert de propriété introuvable.');
        }
        if (transfer.status !== 'PENDING') {
          throw new ConflictException('Ce transfert n’est plus actif.');
        }
        if (transfer.expiresAt <= now) {
          await tx.profileCircleOwnershipTransfer.update({
            where: { id: transferId },
            data: { status: 'EXPIRED' }
          });
          throw new ConflictException('Ce transfert a expiré.');
        }

        const target = await tx.profileCircleMember.findUnique({
          where: {
            circleId_userId: {
              circleId: transfer.circleId,
              userId: transfer.toUserId
            }
          }
        });
        if (!target || target.status !== 'ACTIVE') {
          throw new ConflictException('Le destinataire n’est plus membre actif.');
        }

        const changed = await tx.profileCircle.updateMany({
          where: {
            id: transfer.circleId,
            ownerUserId: transfer.fromUserId,
            status: { not: 'ENDED' }
          },
          data: { ownerUserId: transfer.toUserId }
        });
        if (changed.count !== 1) {
          throw new ConflictException('La propriété a changé avant l’acceptation.');
        }

        await Promise.all([
          tx.profileCircleMember.upsert({
            where: {
              circleId_userId: {
                circleId: transfer.circleId,
                userId: transfer.fromUserId
              }
            },
            create: {
              circleId: transfer.circleId,
              userId: transfer.fromUserId,
              role: 'ADMIN',
              status: 'ACTIVE',
              consentedAt: now,
              joinedAt: now
            },
            update: { role: 'ADMIN' }
          }),
          tx.profileCircleMember.update({
            where: { id: target.id },
            data: { role: 'OWNER' }
          })
        ]);
        const accepted = await tx.profileCircleOwnershipTransfer.update({
          where: { id: transferId },
          data: { status: 'ACCEPTED', acceptedAt: now }
        });
        await tx.profileCircleOwnershipTransfer.updateMany({
          where: {
            circleId: transfer.circleId,
            id: { not: transferId },
            status: 'PENDING'
          },
          data: { status: 'CANCELLED', cancelledAt: now }
        });
        return accepted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_OWNERSHIP_TRANSFER_ACCEPTED',
      entity: 'ProfileCircleOwnershipTransfer',
      entityId: transferId,
      targetAccountId: userId,
      metadata: { circleId: result.circleId, previousOwnerId: result.fromUserId }
    });
    return result;
  }

  async cancelOwnershipTransfer(userId: string, transferId: string) {
    const transfer = await this.prisma.profileCircleOwnershipTransfer.findUnique({
      where: { id: transferId }
    });
    if (
      !transfer ||
      ![transfer.fromUserId, transfer.toUserId].includes(userId)
    ) {
      throw new NotFoundException('Transfert de propriété introuvable.');
    }
    if (transfer.status !== 'PENDING') return transfer;
    const cancelled = await this.prisma.profileCircleOwnershipTransfer.update({
      where: { id: transferId },
      data: { status: 'CANCELLED', cancelledAt: new Date() }
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_OWNERSHIP_TRANSFER_CANCELLED',
      entity: 'ProfileCircleOwnershipTransfer',
      entityId: transferId,
      targetAccountId: transfer.toUserId,
      metadata: { circleId: transfer.circleId }
    });
    return cancelled;
  }

  async createMoment(
    userId: string,
    circleId: string,
    dto: CreateProfileCircleMomentDto
  ) {
    const { circle, membership } = await this.requireActiveMember(userId, circleId);
    this.validateContent(dto.text, dto.assetId, dto.giftInstanceId);
    const role = circle.ownerUserId === userId ? 'OWNER' : membership.role;
    const status = resolveCircleContentInitialStatus({
      role,
      audience: dto.audience
    });
    const moment = await this.prisma.profileCircleMoment.create({
      data: {
        circleId,
        authorUserId: userId,
        type: dto.type as never,
        text: dto.text?.trim() || null,
        assetId: dto.assetId ?? null,
        giftInstanceId: dto.giftInstanceId ?? null,
        audience: dto.audience as never,
        status
      }
    });
    if (status === 'APPROVED') {
      await this.creditContentActivity(circleId, userId, 'MOMENT_PUBLISHED', moment.id, 25);
    }
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_MOMENT_CREATED',
      entity: 'ProfileCircleMoment',
      entityId: moment.id,
      targetAccountId: circle.ownerUserId,
      metadata: { circleId, status, audience: dto.audience }
    });
    return moment;
  }

  async createStory(
    userId: string,
    circleId: string,
    dto: CreateProfileCircleStoryDto
  ) {
    const { circle, membership } = await this.requireActiveMember(userId, circleId);
    this.validateContent(dto.text, dto.assetId, dto.giftInstanceId);
    const policy = circleStoryDurationPolicy(circle.level);
    if (dto.durationHours > policy.maximumHours) {
      throw new BadRequestException(
        `Ce niveau autorise au maximum ${policy.maximumHours} heures.`
      );
    }
    const role = circle.ownerUserId === userId ? 'OWNER' : membership.role;
    const status = resolveCircleContentInitialStatus({
      role,
      audience: dto.audience
    });
    const expiresAt = new Date(
      Date.now() + dto.durationHours * 60 * 60 * 1000
    );
    const story = await this.prisma.profileCircleStory.create({
      data: {
        circleId,
        authorUserId: userId,
        type: dto.type as never,
        text: dto.text?.trim() || null,
        assetId: dto.assetId ?? null,
        giftInstanceId: dto.giftInstanceId ?? null,
        audience: dto.audience as never,
        status,
        expiresAt
      }
    });
    if (status === 'APPROVED') {
      await this.creditContentActivity(circleId, userId, 'STORY_PUBLISHED', story.id, 15);
    }
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_STORY_CREATED',
      entity: 'ProfileCircleStory',
      entityId: story.id,
      targetAccountId: circle.ownerUserId,
      metadata: {
        circleId,
        status,
        audience: dto.audience,
        expiresAt: expiresAt.toISOString()
      }
    });
    return story;
  }

  async publicBundle(slug: string, viewerId: string | null) {
    const base = await this.circles.publicSnapshot(slug, viewerId);
    const isMember = base.viewer.member;
    const now = new Date();
    const [moments, stories, familyRelations] = await Promise.all([
      this.prisma.profileCircleMoment.findMany({
        where: {
          circleId: base.circle.id,
          status: 'APPROVED',
          ...(isMember ? {} : { audience: 'PUBLIC' })
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50
      }),
      this.prisma.profileCircleStory.findMany({
        where: {
          circleId: base.circle.id,
          status: 'APPROVED',
          expiresAt: { gt: now },
          ...(isMember ? {} : { audience: 'PUBLIC' })
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50
      }),
      base.circle.type === 'FAMILY'
        ? this.prisma.profileFamilyRelation.findMany({
            where: { circleId: base.circle.id, status: 'ACTIVE' },
            orderBy: [{ acceptedAt: 'asc' }, { id: 'asc' }]
          })
        : []
    ]);

    const authorIds = new Set<string>();
    for (const entry of [...moments, ...stories]) authorIds.add(entry.authorUserId);
    for (const relation of familyRelations) {
      authorIds.add(relation.firstUserId);
      authorIds.add(relation.secondUserId);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...authorIds] } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return {
      ...base,
      moments: moments.map((moment) => ({
        ...moment,
        author: userMap.get(moment.authorUserId) ?? null
      })),
      stories: stories.map((story) => ({
        ...story,
        author: userMap.get(story.authorUserId) ?? null
      })),
      familyTree:
        base.circle.type === 'FAMILY'
          ? familyRelations.map((relation) => ({
              id: relation.id,
              type: relation.type,
              inverseType: relation.inverseType,
              label: relation.label,
              first: userMap.get(relation.firstUserId) ?? null,
              second: userMap.get(relation.secondUserId) ?? null,
              acceptedAt: relation.acceptedAt
            }))
          : null,
      contentPrivacy: {
        pendingContentOmitted: true,
        hiddenContentOmitted: true,
        expiredStoriesOmitted: true,
        familyPendingRelationsOmitted: true,
        serverResolved: true
      }
    };
  }

  async moderationQueue(userId: string, circleId: string) {
    await this.requirePermission(userId, circleId, 'MODERATE_CONTENT');
    const now = new Date();
    const [moments, stories] = await Promise.all([
      this.prisma.profileCircleMoment.findMany({
        where: { circleId, status: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      }),
      this.prisma.profileCircleStory.findMany({
        where: {
          circleId,
          status: 'PENDING',
          expiresAt: { gt: now }
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      })
    ]);
    return { moments, stories };
  }

  async moderateMoment(
    userId: string,
    momentId: string,
    dto: ModerateProfileCircleContentDto
  ) {
    const moment = await this.prisma.profileCircleMoment.findUnique({
      where: { id: momentId }
    });
    if (!moment) throw new NotFoundException('Moment collectif introuvable.');
    await this.requirePermission(userId, moment.circleId, 'MODERATE_CONTENT');
    const status = this.moderationStatus(dto.action);
    const updated = await this.prisma.profileCircleMoment.update({
      where: { id: momentId },
      data: {
        status,
        moderatedById: userId,
        moderatedAt: new Date()
      }
    });
    if (status === 'APPROVED') {
      await this.creditContentActivity(
        moment.circleId,
        moment.authorUserId,
        'MOMENT_PUBLISHED',
        moment.id,
        25
      );
    }
    await this.recordModerationAudit(userId, 'ProfileCircleMoment', updated.id, moment.circleId, dto);
    return updated;
  }

  async moderateStory(
    userId: string,
    storyId: string,
    dto: ModerateProfileCircleContentDto
  ) {
    const story = await this.prisma.profileCircleStory.findUnique({
      where: { id: storyId }
    });
    if (!story) throw new NotFoundException('Story collective introuvable.');
    await this.requirePermission(userId, story.circleId, 'MODERATE_CONTENT');
    const status = this.moderationStatus(dto.action);
    const updated = await this.prisma.profileCircleStory.update({
      where: { id: storyId },
      data: {
        status,
        moderatedById: userId,
        moderatedAt: new Date()
      }
    });
    if (status === 'APPROVED' && updated.expiresAt > new Date()) {
      await this.creditContentActivity(
        story.circleId,
        story.authorUserId,
        'STORY_PUBLISHED',
        story.id,
        15
      );
    }
    await this.recordModerationAudit(userId, 'ProfileCircleStory', updated.id, story.circleId, dto);
    return updated;
  }

  async proposeFamilyRelation(
    userId: string,
    circleId: string,
    dto: CreateProfileFamilyRelationDto
  ) {
    const { circle } = await this.requireActiveMember(userId, circleId);
    const other = await this.prisma.profileCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: dto.otherUserId }
      }
    });
    let validated: {
      pairKey: string;
      inverseType: ProfileFamilyRelationType;
    };
    try {
      validated = validateFamilyRelationProposal({
        circleId,
        circleType: circle.type,
        proposerUserId: userId,
        firstUserId: userId,
        secondUserId: dto.otherUserId,
        firstIsActiveMember: true,
        secondIsActiveMember: other?.status === 'ACTIVE',
        type: dto.type
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Lien familial invalide.'
      );
    }

    const existing = await this.prisma.profileFamilyRelation.findUnique({
      where: { circleId_pairKey: { circleId, pairKey: validated.pairKey } }
    });
    if (existing?.status === 'ACTIVE') {
      throw new ConflictException('Un lien familial actif existe déjà entre ces membres.');
    }

    const relation = await this.prisma.profileFamilyRelation.upsert({
      where: { circleId_pairKey: { circleId, pairKey: validated.pairKey } },
      create: {
        circleId,
        pairKey: validated.pairKey,
        firstUserId: userId,
        secondUserId: dto.otherUserId,
        type: dto.type as never,
        inverseType: inverseFamilyRelationType(dto.type) as never,
        label: dto.label?.trim() || null,
        proposedById: userId
      },
      update: {
        firstUserId: userId,
        secondUserId: dto.otherUserId,
        type: dto.type as never,
        inverseType: inverseFamilyRelationType(dto.type) as never,
        label: dto.label?.trim() || null,
        status: 'PENDING',
        proposedById: userId,
        acceptedById: null,
        acceptedAt: null,
        removedAt: null
      }
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_FAMILY_RELATION_PROPOSED',
      entity: 'ProfileFamilyRelation',
      entityId: relation.id,
      targetAccountId: dto.otherUserId,
      metadata: { circleId, type: dto.type }
    });
    return relation;
  }

  async familyRelationAction(
    userId: string,
    relationId: string,
    dto: ProfileFamilyRelationActionDto
  ) {
    const relation = await this.prisma.profileFamilyRelation.findUnique({
      where: { id: relationId }
    });
    if (!relation) throw new NotFoundException('Lien familial introuvable.');
    const participant = [relation.firstUserId, relation.secondUserId].includes(userId);
    if (!participant) throw new ForbiddenException('Action réservée aux personnes concernées.');

    if (dto.action === 'ACCEPT') {
      if (relation.status !== 'PENDING') {
        throw new ConflictException('Ce lien familial n’est plus en attente.');
      }
      if (relation.proposedById === userId) {
        throw new ConflictException('L’autre personne doit accepter le lien.');
      }
      const updated = await this.prisma.profileFamilyRelation.update({
        where: { id: relationId },
        data: {
          status: 'ACTIVE',
          acceptedById: userId,
          acceptedAt: new Date()
        }
      });
      await this.audit.record({
        actorId: userId,
        action: 'PROFILE_FAMILY_RELATION_ACCEPTED',
        entity: 'ProfileFamilyRelation',
        entityId: relationId,
        targetAccountId: relation.proposedById,
        metadata: { circleId: relation.circleId }
      });
      return updated;
    }

    const status = dto.action === 'DECLINE' ? 'DECLINED' : 'REMOVED';
    const updated = await this.prisma.profileFamilyRelation.update({
      where: { id: relationId },
      data: {
        status,
        ...(status === 'REMOVED' ? { removedAt: new Date() } : {})
      }
    });
    await this.audit.record({
      actorId: userId,
      action: `PROFILE_FAMILY_RELATION_${dto.action}`,
      entity: 'ProfileFamilyRelation',
      entityId: relationId,
      targetAccountId:
        relation.firstUserId === userId
          ? relation.secondUserId
          : relation.firstUserId,
      metadata: { circleId: relation.circleId }
    });
    return updated;
  }

  async pendingFamilyRelations(userId: string) {
    return this.prisma.profileFamilyRelation.findMany({
      where: {
        status: 'PENDING',
        proposedById: { not: userId },
        OR: [{ firstUserId: userId }, { secondUserId: userId }]
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
  }

  async pruneExpired(now = new Date()) {
    const [stories, transfers] = await this.prisma.$transaction([
      this.prisma.profileCircleStory.updateMany({
        where: {
          expiresAt: { lte: now },
          status: { in: ['PENDING', 'APPROVED'] }
        },
        data: { status: 'HIDDEN' }
      }),
      this.prisma.profileCircleOwnershipTransfer.updateMany({
        where: { expiresAt: { lte: now }, status: 'PENDING' },
        data: { status: 'EXPIRED' }
      })
    ]);
    return { stories, transfers };
  }

  private async requireActiveMember(userId: string, circleId: string) {
    const membership = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
      include: { circle: true }
    });
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.circle.status !== 'ACTIVE'
    ) {
      throw new ForbiddenException('Participation collective active requise.');
    }
    return { circle: membership.circle, membership };
  }

  private async requirePermission(
    userId: string,
    circleId: string,
    permission: ProfileCirclePermission
  ) {
    const membership = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
      include: { circle: true }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Participation collective active requise.');
    }
    const role =
      membership.circle.ownerUserId === userId ? 'OWNER' : membership.role;
    if (!roleHasCirclePermission(role, permission)) {
      throw new ForbiddenException('Permission collective insuffisante.');
    }
    return { circle: membership.circle, membership };
  }

  private validateContent(
    text?: string,
    assetId?: string,
    giftInstanceId?: string
  ) {
    if (!text?.trim() && !assetId && !giftInstanceId) {
      throw new BadRequestException('Le contenu collectif est vide.');
    }
  }

  private moderationStatus(action: 'APPROVE' | 'HIDE' | 'REMOVE') {
    if (action === 'APPROVE') return 'APPROVED' as const;
    if (action === 'HIDE') return 'HIDDEN' as const;
    return 'REMOVED' as const;
  }

  private async creditContentActivity(
    circleId: string,
    actorUserId: string,
    type: 'MOMENT_PUBLISHED' | 'STORY_PUBLISHED',
    sourceId: string,
    xpAwarded: number
  ) {
    await this.circles.recordActivity({
      circleId,
      actorUserId,
      type,
      xpAwarded,
      sourceType: type,
      sourceId,
      idempotencyKey: `profile-circle-content:${type}:${sourceId}`
    });
  }

  private async recordModerationAudit(
    actorId: string,
    entity: string,
    entityId: string,
    circleId: string,
    dto: ModerateProfileCircleContentDto
  ) {
    await this.audit.record({
      actorId,
      action: `PROFILE_CIRCLE_CONTENT_${dto.action}`,
      entity,
      entityId,
      targetAccountId: actorId,
      metadata: { circleId, reason: dto.reason?.trim() || null }
    });
  }
}
