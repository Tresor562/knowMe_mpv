import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProfileCircleDto,
  CreateProfileMemoryDto,
  CreateProfileWallPostDto,
  RecordProfileCaptureEventDto,
  UpdateProfileExperienceDto,
  UpdateProfileGuardDto,
  UpdateProfileVisibilityDto
} from './dto/profile-experience.dto';
import {
  PROFILE_AUDIENCES,
  PROFILE_GUARD_SCOPES,
  PROFILE_SECTIONS,
  ProfileAudience,
  ProfileCircleType,
  ProfileSection,
  ProfileViewerRelation,
  circleLimits,
  conceptKProfilePolicy,
  defaultProfileSectionRules,
  profileEvolutionTier,
  profileGuardPlatformPolicy,
  resolveGuardScopes,
  resolveProfileSectionAccess,
  validateProfileCircle
} from './profile-experience.domain';

const PROFILE_GUARD_PREMIUM_ENTITLEMENT = 'profile.guard.granular';
const ANIMATED_AVATAR_PREMIUM_ENTITLEMENT = 'profile.avatar.animated';

@Injectable()
export class ProfileExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return {
      ...conceptKProfilePolicy(),
      guardPlatforms: {
        android: profileGuardPlatformPolicy('ANDROID'),
        ios: profileGuardPlatformPolicy('IOS'),
        web: profileGuardPlatformPolicy('WEB'),
        desktop: profileGuardPlatformPolicy('DESKTOP')
      }
    };
  }

  async ensureProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

    const shortCode = this.shortCode();
    const profile = await this.prisma.profileExperience.upsert({
      where: { userId },
      create: { userId, publicShortCode: shortCode },
      update: {}
    });

    await Promise.all([
      this.prisma.profileGuardPreference.upsert({
        where: { userId },
        create: { userId },
        update: {}
      }),
      this.prisma.profileStatSnapshot.upsert({
        where: { userId },
        create: {
          userId,
          metrics: this.defaultStats() as Prisma.InputJsonValue
        },
        update: {}
      }),
      this.prisma.profileShareCard.upsert({
        where: { userId },
        create: {
          userId,
          shortCode: profile.publicShortCode,
          qrPayload: `https://km.app/${profile.publicShortCode}`
        },
        update: {}
      })
    ]);

    const defaults = defaultProfileSectionRules();
    await Promise.all(
      defaults.map((rule) =>
        this.prisma.profileSectionVisibility.upsert({
          where: {
            userId_section: { userId, section: rule.section }
          },
          create: { userId, ...rule },
          update: {}
        })
      )
    );

    return profile;
  }

  async ownerDashboard(userId: string) {
    const profile = await this.ensureProfile(userId);
    const [
      guard,
      stats,
      visibilities,
      circles,
      timeline,
      memories,
      showcase,
      shareCard,
      wallSummary
    ] = await Promise.all([
      this.prisma.profileGuardPreference.findUnique({ where: { userId } }),
      this.prisma.profileStatSnapshot.findUnique({ where: { userId } }),
      this.prisma.profileSectionVisibility.findMany({
        where: { userId },
        orderBy: { section: 'asc' }
      }),
      this.prisma.profileCircleMember.findMany({
        where: { userId, status: { in: ['INVITED', 'ACTIVE'] } },
        include: { circle: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.profileTimelineEvent.findMany({
        where: { userId },
        orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }],
        take: 50
      }),
      this.prisma.profileMemoryVaultItem.findMany({
        where: { userId },
        orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
        take: 100
      }),
      this.prisma.profileGiftShowcaseItem.findMany({
        where: { userId },
        orderBy: [{ pinned: 'desc' }, { position: 'asc' }]
      }),
      this.prisma.profileShareCard.findUnique({ where: { userId } }),
      this.prisma.profileWallPost.groupBy({
        by: ['status'],
        where: { profileOwnerId: userId },
        _count: { _all: true }
      })
    ]);

    return {
      profile,
      guard,
      stats,
      visibilities,
      circles,
      timeline,
      memories,
      showcase,
      shareCard,
      wallSummary,
      evolution: profileEvolutionTier(this.numericStat(stats?.metrics, 'level', 1)),
      guarantees: {
        memoriesPrivateByDefault: true,
        oldUsernamesPubliclyReturned: false,
        accessServerResolved: true,
        clientPremiumFlagsTrusted: false
      }
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileExperienceDto) {
    await this.ensureProfile(userId);

    if (dto.animatedAvatarEnabled) {
      const premium = await this.entitlements.hasAll(userId, [
        ANIMATED_AVATAR_PREMIUM_ENTITLEMENT
      ]);
      if (!premium) {
        throw new ForbiddenException('L’avatar animé de profil exige Premium.');
      }
    }

    const data: Prisma.ProfileExperienceUpdateInput = {
      ...(dto.coverAssetId !== undefined ? { coverAssetId: dto.coverAssetId } : {}),
      ...(dto.coverVideoAssetId !== undefined
        ? { coverVideoAssetId: dto.coverVideoAssetId }
        : {}),
      ...(dto.frameAssetId !== undefined ? { frameAssetId: dto.frameAssetId } : {}),
      ...(dto.themeKey !== undefined ? { themeKey: dto.themeKey.trim() } : {}),
      ...(dto.effectKey !== undefined ? { effectKey: dto.effectKey } : {}),
      ...(dto.intelligentBio !== undefined
        ? {
            intelligentBio:
              dto.intelligentBio === null
                ? Prisma.JsonNull
                : (dto.intelligentBio as Prisma.InputJsonValue)
          }
        : {}),
      ...(dto.influencerMode !== undefined ? { influencerMode: dto.influencerMode } : {}),
      ...(dto.wallMode !== undefined ? { wallMode: dto.wallMode } : {}),
      ...(dto.profileLocked !== undefined ? { profileLocked: dto.profileLocked } : {}),
      ...(dto.profileEvolutionEnabled !== undefined
        ? { profileEvolutionEnabled: dto.profileEvolutionEnabled }
        : {}),
      ...(dto.weatherEffectsEnabled !== undefined
        ? { weatherEffectsEnabled: dto.weatherEffectsEnabled }
        : {}),
      ...(dto.seasonalEffectsEnabled !== undefined
        ? { seasonalEffectsEnabled: dto.seasonalEffectsEnabled }
        : {}),
      ...(dto.birthdayEffectsEnabled !== undefined
        ? { birthdayEffectsEnabled: dto.birthdayEffectsEnabled }
        : {}),
      ...(dto.animatedAvatarEnabled !== undefined
        ? { animatedAvatarEnabled: dto.animatedAvatarEnabled }
        : {})
    };

    const profile = await this.prisma.profileExperience.update({
      where: { userId },
      data
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_EXPERIENCE_UPDATED',
      entity: 'ProfileExperience',
      entityId: userId,
      targetAccountId: userId,
      metadata: {
        profileLocked: profile.profileLocked,
        influencerMode: profile.influencerMode,
        wallMode: profile.wallMode,
        animatedAvatarEnabled: profile.animatedAvatarEnabled
      }
    });

    return profile;
  }

  async updateVisibility(userId: string, dto: UpdateProfileVisibilityDto) {
    await this.ensureProfile(userId);
    if (!Array.isArray(dto.rules) || dto.rules.length === 0 || dto.rules.length > PROFILE_SECTIONS.length) {
      throw new BadRequestException('Règles de visibilité invalides.');
    }

    const seen = new Set<string>();
    for (const rule of dto.rules) {
      if (!PROFILE_SECTIONS.includes(rule.section)) {
        throw new BadRequestException(`Section inconnue : ${rule.section}`);
      }
      if (!PROFILE_AUDIENCES.includes(rule.audience)) {
        throw new BadRequestException(`Audience inconnue : ${rule.audience}`);
      }
      if (typeof rule.allowedWhenLocked !== 'boolean') {
        throw new BadRequestException('Le réglage verrouillé doit être booléen.');
      }
      if (seen.has(rule.section)) {
        throw new BadRequestException(`Section dupliquée : ${rule.section}`);
      }
      seen.add(rule.section);
    }

    await this.prisma.$transaction(
      dto.rules.map((rule) =>
        this.prisma.profileSectionVisibility.upsert({
          where: { userId_section: { userId, section: rule.section } },
          create: { userId, ...rule },
          update: {
            audience: rule.audience,
            allowedWhenLocked: rule.allowedWhenLocked
          }
        })
      )
    );

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_VISIBILITY_UPDATED',
      entity: 'ProfileSectionVisibility',
      entityId: userId,
      targetAccountId: userId,
      metadata: { sections: [...seen] }
    });

    return this.prisma.profileSectionVisibility.findMany({
      where: { userId },
      orderBy: { section: 'asc' }
    });
  }

  async updateGuard(userId: string, dto: UpdateProfileGuardDto) {
    await this.ensureProfile(userId);
    if (!dto.platformDisclosureAccepted && dto.enabled) {
      throw new BadRequestException(
        'Les limites Android, iOS et Web doivent être comprises avant activation.'
      );
    }

    const hasPremium = await this.entitlements.hasAll(userId, [
      PROFILE_GUARD_PREMIUM_ENTITLEMENT
    ]);
    const resolved = resolveGuardScopes({
      enabled: dto.enabled,
      requestedScopes: dto.scopes,
      hasPremiumEntitlement: hasPremium
    });

    if (dto.style && dto.style !== 'GLASS' && !hasPremium) {
      throw new ForbiddenException('Les styles décoratifs Guard exigent Premium.');
    }

    const guard = await this.prisma.profileGuardPreference.upsert({
      where: { userId },
      create: {
        userId,
        enabled: dto.enabled,
        scopes: resolved.scopes as Prisma.InputJsonValue,
        style: (dto.style ?? 'GLASS') as never,
        warnViewer: dto.warnViewer,
        notifyOwner: dto.notifyOwner,
        premiumGranularControl: hasPremium,
        platformDisclosureAccepted: dto.platformDisclosureAccepted
      },
      update: {
        enabled: dto.enabled,
        scopes: resolved.scopes as Prisma.InputJsonValue,
        ...(dto.style ? { style: dto.style as never } : {}),
        warnViewer: dto.warnViewer,
        notifyOwner: dto.notifyOwner,
        premiumGranularControl: hasPremium,
        platformDisclosureAccepted: dto.platformDisclosureAccepted
      }
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_GUARD_UPDATED',
      entity: 'ProfileGuardPreference',
      entityId: userId,
      targetAccountId: userId,
      metadata: {
        enabled: guard.enabled,
        scopes: resolved.scopes,
        notifyOwner: guard.notifyOwner,
        premiumGranularControl: guard.premiumGranularControl
      }
    });

    return { guard, resolved };
  }

  async createCircle(userId: string, dto: CreateProfileCircleDto) {
    await this.ensureProfile(userId);
    const memberIds = [...new Set([userId, ...dto.memberUserIds])];
    const limits = circleLimits(dto.type as ProfileCircleType);
    if (memberIds.length < limits.minimumMembers || memberIds.length > limits.maximumMembers) {
      throw new BadRequestException(
        `Cette relation accepte de ${limits.minimumMembers} à ${limits.maximumMembers} membres.`
      );
    }

    const users = await this.prisma.user.count({ where: { id: { in: memberIds } } });
    if (users !== memberIds.length) throw new NotFoundException('Un ou plusieurs membres sont introuvables.');

    const existingDuo = dto.type.startsWith('DUO_')
      ? await this.prisma.profileCircleMember.findFirst({
          where: {
            userId,
            status: { in: ['INVITED', 'ACTIVE'] },
            circle: {
              type: { in: ['DUO_COUPLE', 'DUO_BEST_FRIENDS', 'DUO_SIBLINGS', 'DUO_GAMING', 'DUO_CREATIVE'] },
              status: { in: ['PENDING', 'ACTIVE', 'PAUSED'] }
            }
          }
        })
      : null;
    if (existingDuo) throw new ConflictException('Ce profil possède déjà un Duo actif ou en attente.');

    const slug = `${this.slug(dto.name)}-${this.shortCode(4).toLowerCase()}`;
    const circle = await this.prisma.profileCircle.create({
      data: {
        type: dto.type as never,
        name: dto.name.trim(),
        slug,
        ownerUserId: userId,
        sharedBio: dto.sharedBio?.trim() || null,
        animationKey: dto.animationKey?.trim() || null,
        accentColor: dto.accentColor ?? '#45e6bd',
        maxMembers: limits.maximumMembers,
        joinable: limits.joinable,
        members: {
          create: memberIds.map((memberId, index) => ({
            userId: memberId,
            role: memberId === userId ? 'OWNER' : 'MEMBER',
            status: memberId === userId ? 'ACTIVE' : 'INVITED',
            consentedAt: memberId === userId ? new Date() : null,
            joinedAt: memberId === userId ? new Date() : null,
            portraitPosition: index
          }))
        }
      },
      include: { members: true }
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_CREATED',
      entity: 'ProfileCircle',
      entityId: circle.id,
      targetAccountId: userId,
      metadata: { type: circle.type, members: memberIds.length, status: circle.status }
    });

    return circle;
  }

  async acceptCircle(userId: string, circleId: string) {
    const membership = await this.prisma.profileCircleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
      include: { circle: { include: { members: true } } }
    });
    if (!membership) throw new NotFoundException('Invitation de profil introuvable.');
    if (membership.status === 'DECLINED' || membership.status === 'REMOVED') {
      throw new ConflictException('Cette invitation n’est plus active.');
    }

    await this.prisma.profileCircleMember.update({
      where: { id: membership.id },
      data: {
        status: 'ACTIVE',
        consentedAt: membership.consentedAt ?? new Date(),
        joinedAt: membership.joinedAt ?? new Date(),
        leftAt: null
      }
    });

    const members = await this.prisma.profileCircleMember.findMany({
      where: { circleId }
    });
    const active = members.filter((entry) => entry.status === 'ACTIVE').length;
    let activated = false;
    if (active === members.length) {
      validateProfileCircle({
        type: membership.circle.type as ProfileCircleType,
        memberCount: members.length,
        activeConsents: active,
        level: membership.circle.level,
        xp: membership.circle.xp
      });
      await this.prisma.profileCircle.update({
        where: { id: circleId },
        data: { status: 'ACTIVE' }
      });
      activated = true;
    }

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CIRCLE_ACCEPTED',
      entity: 'ProfileCircle',
      entityId: circleId,
      targetAccountId: userId,
      metadata: { activated }
    });

    return this.prisma.profileCircle.findUnique({
      where: { id: circleId },
      include: { members: true }
    });
  }

  async publicSnapshot(username: string, viewerId: string | null) {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        role: true
      }
    });
    if (!target) throw new NotFoundException('Profil introuvable.');

    const profile = await this.ensureProfile(target.id);
    const relation = await this.resolveViewerRelation(target.id, viewerId);
    const rules = await this.prisma.profileSectionVisibility.findMany({
      where: { userId: target.id }
    });
    const ruleMap = new Map(rules.map((rule) => [rule.section, rule]));

    const access = (section: ProfileSection) => {
      const rule = ruleMap.get(section);
      return resolveProfileSectionAccess({
        section,
        audience: (rule?.audience ?? (section === 'HEADER' ? 'PUBLIC' : 'FRIENDS')) as ProfileAudience,
        allowedWhenLocked: rule?.allowedWhenLocked ?? section === 'HEADER',
        profileLocked: profile.profileLocked,
        viewerRelation: relation
      });
    };

    const sectionAccess = Object.fromEntries(
      PROFILE_SECTIONS.map((section) => [section, access(section)])
    );

    const [guard, stats, timeline, wall, circles, showcase, compatibility, secretPage] =
      await Promise.all([
        this.prisma.profileGuardPreference.findUnique({ where: { userId: target.id } }),
        access('STATISTICS').visible
          ? this.prisma.profileStatSnapshot.findUnique({ where: { userId: target.id } })
          : null,
        access('TIMELINE').visible
          ? this.prisma.profileTimelineEvent.findMany({
              where: { userId: target.id },
              orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }],
              take: 30
            })
          : [],
        access('WALL').visible
          ? this.prisma.profileWallPost.findMany({
              where: { profileOwnerId: target.id, status: 'APPROVED' },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 30
            })
          : [],
        access('CIRCLES').visible
          ? this.prisma.profileCircleMember.findMany({
              where: { userId: target.id, status: 'ACTIVE', circle: { status: 'ACTIVE' } },
              include: { circle: true },
              orderBy: { joinedAt: 'asc' }
            })
          : [],
        access('GIFTS').visible
          ? this.prisma.profileGiftShowcaseItem.findMany({
              where: { userId: target.id },
              orderBy: [{ pinned: 'desc' }, { position: 'asc' }]
            })
          : [],
        viewerId && viewerId !== target.id && access('COMPATIBILITY').visible
          ? this.prisma.profileCompatibilitySnapshot.findUnique({
              where: { pairKey: this.pairKey(viewerId, target.id) }
            })
          : null,
        this.prisma.secretPage.findFirst({
          where: { ownerId: target.id, enabled: true, profileEntryEnabled: true },
          select: { slug: true }
        })
      ]);

    const visibleTimeline = (timeline ?? []).filter((event) =>
      resolveProfileSectionAccess({
        section: 'TIMELINE',
        audience: event.visibility as ProfileAudience,
        allowedWhenLocked: access('TIMELINE').visible,
        profileLocked: profile.profileLocked,
        viewerRelation: relation
      }).visible
    );

    const visibleCircles = (circles ?? []).filter((entry) =>
      resolveProfileSectionAccess({
        section: 'CIRCLES',
        audience: entry.circle.visibility as ProfileAudience,
        allowedWhenLocked: access('CIRCLES').visible,
        profileLocked: profile.profileLocked,
        viewerRelation: relation
      }).visible
    );

    const level = this.numericStat(stats?.metrics, 'level', 1);
    const lockedForViewer =
      profile.profileLocked &&
      relation !== 'OWNER' &&
      ['PUBLIC', 'FOLLOWER', 'COMMUNITY_MEMBER'].includes(relation);

    return {
      header: {
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl,
        bio: access('BIO').visible ? target.bio : null,
        joinedYear: access('STATISTICS').visible ? target.createdAt.getUTCFullYear() : null,
        coverAssetId: profile.coverAssetId,
        coverVideoAssetId: profile.coverVideoAssetId,
        frameAssetId: profile.frameAssetId,
        themeKey: profile.themeKey,
        effectKey: profile.effectKey,
        influencerMode: profile.influencerMode,
        secretLink: secretPage ? `/secret/${secretPage.slug}?entry=PUBLIC_PROFILE_CTA` : null
      },
      viewer: {
        relation,
        owner: relation === 'OWNER'
      },
      privacy: {
        profileLocked: profile.profileLocked,
        lockedForViewer,
        lockMessage: lockedForViewer
          ? 'Ce profil est verrouillé. Ajoutez cette personne en ami pour découvrir davantage de contenu.'
          : null,
        sections: sectionAccess,
        serverResolved: true,
        hiddenDataOmitted: true
      },
      guard: guard?.enabled
        ? {
            protected: true,
            style: guard.style,
            warnViewer: guard.warnViewer,
            disclosure: {
              android: profileGuardPlatformPolicy('ANDROID').disclosure,
              ios: profileGuardPlatformPolicy('IOS').disclosure,
              web: profileGuardPlatformPolicy('WEB').disclosure
            }
          }
        : { protected: false },
      statistics: access('STATISTICS').visible ? stats?.metrics ?? {} : null,
      evolution: profile.profileEvolutionEnabled ? profileEvolutionTier(level) : null,
      circles: access('CIRCLES').visible
        ? visibleCircles.map((entry) => ({
            id: entry.circle.id,
            type: entry.circle.type,
            name: entry.circle.name,
            slug: entry.circle.slug,
            bannerAssetId: entry.circle.bannerAssetId,
            emblemAssetId: entry.circle.emblemAssetId,
            accentColor: entry.circle.accentColor,
            level: entry.circle.level,
            xp: entry.circle.xp,
            role: entry.role
          }))
        : null,
      timeline: access('TIMELINE').visible ? visibleTimeline : null,
      wall: access('WALL').visible ? wall : null,
      gifts: access('GIFTS').visible ? showcase : null,
      compatibility:
        compatibility && compatibility.expiresAt > new Date()
          ? {
              overallBps: compatibility.overallBps,
              categories: compatibility.categories,
              explanation: compatibility.explanation,
              privateSignalsExposed: false
            }
          : null,
      shareCard: {
        shortCode: profile.publicShortCode,
        url: `https://km.app/${profile.publicShortCode}`,
        qrPayload: `https://km.app/${profile.publicShortCode}`
      }
    };
  }

  async createWallPost(
    authorId: string,
    profileUsername: string,
    dto: CreateProfileWallPostDto
  ) {
    const target = await this.prisma.user.findUnique({
      where: { username: profileUsername },
      select: { id: true }
    });
    if (!target) throw new NotFoundException('Profil introuvable.');
    const profile = await this.ensureProfile(target.id);
    if (profile.wallMode === 'DISABLED') {
      throw new ForbiddenException('Le mur de ce profil est désactivé.');
    }
    if (profile.wallMode === 'FRIENDS' && authorId !== target.id) {
      const friends = await this.areFriends(authorId, target.id);
      if (!friends) throw new ForbiddenException('Le mur est réservé aux amis.');
    }
    if (!dto.text && !dto.assetId && !dto.giftInstanceId) {
      throw new BadRequestException('Le message de mur est vide.');
    }

    const post = await this.prisma.profileWallPost.create({
      data: {
        profileOwnerId: target.id,
        authorId,
        contentType: dto.contentType,
        text: dto.text?.trim() || null,
        assetId: dto.assetId ?? null,
        giftInstanceId: dto.giftInstanceId ?? null,
        status: authorId === target.id ? 'APPROVED' : 'PENDING'
      }
    });

    await this.audit.record({
      actorId: authorId,
      action: 'PROFILE_WALL_POST_CREATED',
      entity: 'ProfileWallPost',
      entityId: post.id,
      targetAccountId: target.id,
      metadata: { status: post.status, contentType: post.contentType }
    });
    return post;
  }

  async addMemory(userId: string, dto: CreateProfileMemoryDto) {
    await this.ensureProfile(userId);
    const memory = await this.prisma.profileMemoryVaultItem.create({
      data: {
        userId,
        type: dto.type as never,
        label: dto.label.trim(),
        assetId: dto.assetId ?? null,
        privateValue: dto.privateValue ?? null,
        sourceType: dto.sourceType ?? null,
        sourceId: dto.sourceId ?? null,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date()
      }
    });
    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_MEMORY_ADDED',
      entity: 'ProfileMemoryVaultItem',
      entityId: memory.id,
      targetAccountId: userId,
      metadata: { type: memory.type }
    });
    return memory;
  }

  async memories(userId: string) {
    await this.ensureProfile(userId);
    return this.prisma.profileMemoryVaultItem.findMany({
      where: { userId },
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      take: 200
    });
  }

  async recordCaptureEvent(viewerId: string, dto: RecordProfileCaptureEventDto) {
    const guard = await this.prisma.profileGuardPreference.findUnique({
      where: { userId: dto.ownerUserId }
    });
    if (!guard?.enabled && !['PAYMENTS', 'ADMIN', 'VIEW_ONCE_MEDIA', 'SENSITIVE_DOCUMENTS'].includes(dto.scope)) {
      throw new BadRequestException('La zone indiquée n’est pas protégée.');
    }

    // KMD-040 ne fait jamais confiance à un booléen client. Un validateur natif
    // attesté devra être branché avant qu’un événement puisse notifier le propriétaire.
    const attestationValid = false;
    const event = await this.prisma.profileCaptureSecurityEvent.create({
      data: {
        ownerUserId: dto.ownerUserId,
        viewerUserId: viewerId,
        platform: dto.platform as never,
        eventType: dto.eventType as never,
        scope: dto.scope,
        nativeSignal: dto.nativeSignal,
        attestationValid,
        ownerNotified: false,
        clientOccurredAt: dto.clientOccurredAt ? new Date(dto.clientOccurredAt) : null,
        metadata: {
          ...(dto.metadata ?? {}),
          attestationProviderConfigured: false,
          clientAttestationAccepted: false
        } as Prisma.InputJsonValue
      }
    });

    await this.audit.record({
      actorId: viewerId,
      action: 'PROFILE_CAPTURE_SIGNAL_RECORDED',
      entity: 'ProfileCaptureSecurityEvent',
      entityId: event.id,
      targetAccountId: dto.ownerUserId,
      metadata: {
        platform: dto.platform,
        eventType: dto.eventType,
        scope: dto.scope,
        ownerNotified: false
      }
    });

    return {
      accepted: true,
      eventId: event.id,
      ownerNotified: false,
      reason: 'NATIVE_ATTESTATION_PROVIDER_NOT_CONFIGURED'
    };
  }

  async compatibility(userId: string, username: string) {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, displayName: true }
    });
    if (!target) throw new NotFoundException('Profil introuvable.');
    if (target.id === userId) throw new BadRequestException('Compatibilité personnelle non applicable.');

    const snapshot = await this.prisma.profileCompatibilitySnapshot.findUnique({
      where: { pairKey: this.pairKey(userId, target.id) }
    });
    if (!snapshot || snapshot.expiresAt <= new Date()) {
      return {
        available: false,
        target,
        reason: 'INSUFFICIENT_OR_STALE_PRIVACY_SAFE_SIGNALS',
        privateSignalsExposed: false
      };
    }
    return {
      available: true,
      target,
      overallBps: snapshot.overallBps,
      categories: snapshot.categories,
      explanation: snapshot.explanation,
      privateSignalsExposed: false,
      privateMessagesQuoted: false
    };
  }

  private async resolveViewerRelation(
    ownerUserId: string,
    viewerId: string | null
  ): Promise<ProfileViewerRelation> {
    if (!viewerId) return 'PUBLIC';
    if (viewerId === ownerUserId) return 'OWNER';

    const [friend, memberships] = await Promise.all([
      this.areFriends(ownerUserId, viewerId),
      this.prisma.profileCircleMember.findMany({
        where: {
          userId: { in: [ownerUserId, viewerId] },
          status: 'ACTIVE',
          circle: { status: 'ACTIVE' }
        },
        include: { circle: true }
      })
    ]);

    const byCircle = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      const current = byCircle.get(membership.circleId) ?? [];
      current.push(membership);
      byCircle.set(membership.circleId, current);
    }
    const shared = [...byCircle.values()].find((entries) => entries.length === 2);
    const type = shared?.[0]?.circle.type;
    if (type?.startsWith('DUO_')) return 'DUO';
    if (type === 'FAMILY') return 'FAMILY';
    if (type === 'TEAM') return 'TEAM_MEMBER';
    if (type === 'GUILD') return 'GUILD_MEMBER';
    return friend ? 'FRIEND' : 'PUBLIC';
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

  private defaultStats() {
    return {
      level: 1,
      xp: 0,
      challengesCreated: 0,
      challengesWon: 0,
      averageAffinityBps: 0,
      quizzesCreated: 0,
      quizzesCompleted: 0,
      gamesWon: 0,
      friends: 0,
      followers: 0,
      following: 0,
      messagesSent: 0,
      dailyStreak: 0,
      giftsReceived: 0,
      giftsSent: 0,
      knowCoinsEarned: 0,
      knowCoinsSpent: 0,
      activeMinutes: 0
    };
  }

  private numericStat(metrics: Prisma.JsonValue | null | undefined, key: string, fallback: number) {
    if (!metrics || Array.isArray(metrics) || typeof metrics !== 'object') return fallback;
    const value = (metrics as Record<string, Prisma.JsonValue>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private pairKey(firstUserId: string, secondUserId: string) {
    return [firstUserId, secondUserId].sort().join(':');
  }

  private shortCode(bytes = 6) {
    return randomBytes(bytes).toString('base64url');
  }

  private slug(value: string) {
    const slug = value
      .trim()
      .toLocaleLowerCase('fr')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return slug || 'profil';
  }
}
