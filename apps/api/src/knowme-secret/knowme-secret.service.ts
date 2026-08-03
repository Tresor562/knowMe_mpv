import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertSecretMessageAllowed,
  normalizeSecretSlug,
  SecretInboxPreferences,
  SecretMessageCategory
} from './knowme-secret.domain';
import {
  assertSecretPublicAccess,
  SecretEntryPoint
} from './knowme-secret-flow.domain';
import {
  CreateSecretCampaignDto,
  SecretReplyDto,
  SubmitSecretMessageDto,
  UpdateSecretPageDto
} from './knowme-secret.dto';

type RequestFingerprint = {
  ip?: string;
  userAgent?: string;
  acceptLanguage?: string;
};

@Injectable()
export class KnowMeSecretService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService
  ) {}

  async getMine(ownerId: string) {
    const page = await this.ensurePage(ownerId);
    const [campaigns, inboxCount, unreadCount] = await Promise.all([
      this.prisma.secretCampaign.findMany({
        where: { pageId: page.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20
      }),
      this.prisma.secretMessage.count({ where: { pageId: page.id, status: { not: 'DELETED' } } }),
      this.prisma.secretMessage.count({ where: { pageId: page.id, openedAt: null, status: 'DELIVERED' } })
    ]);

    return {
      ...this.serializeOwnerPage(page),
      links: this.pageLinks(page.slug),
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        links: this.campaignLinks(page.slug, campaign.token)
      })),
      inbox: { total: inboxCount, unread: unreadCount }
    };
  }

  async updateMine(ownerId: string, dto: UpdateSecretPageDto) {
    const page = await this.ensurePage(ownerId);
    const data: Record<string, unknown> = {};

    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.profileEntryEnabled !== undefined) data.profileEntryEnabled = dto.profileEntryEnabled;
    if (dto.allowUnauthenticatedSenders !== undefined) {
      data.allowUnauthenticatedSenders = dto.allowUnauthenticatedSenders;
    }
    if (dto.requireChallengeVerification !== undefined) {
      data.requireChallengeVerification = dto.requireChallengeVerification;
    }
    if (dto.publicMessageCountVisible !== undefined) {
      data.publicMessageCountVisible = dto.publicMessageCountVisible;
    }
    if (dto.presentation !== undefined) data.presentation = dto.presentation.trim();
    if (dto.defaultPrompt !== undefined) data.defaultPrompt = dto.defaultPrompt.trim();
    if (dto.minimumAccountAgeHours !== undefined) {
      data.minimumAccountAgeHours = dto.minimumAccountAgeHours;
    }
    if (dto.dailyLimitPerSender !== undefined) data.dailyLimitPerSender = dto.dailyLimitPerSender;
    if (dto.pausedUntil !== undefined) {
      data.pausedUntil = dto.pausedUntil ? new Date(dto.pausedUntil) : null;
    }
    if (dto.blockedTerms !== undefined) {
      data.blockedTerms = dto.blockedTerms.map((term) => term.trim()).filter(Boolean);
    }
    if (dto.acceptedCategories !== undefined) {
      if (!dto.acceptedCategories.length) {
        throw new BadRequestException('Au moins une catégorie Secret doit rester active.');
      }
      data.acceptedCategories = [...new Set(dto.acceptedCategories)].join(',');
    }
    if (dto.slug !== undefined) {
      const slug = normalizeSecretSlug(dto.slug);
      const conflict = await this.prisma.secretPage.findFirst({
        where: { slug, id: { not: page.id } },
        select: { id: true }
      });
      if (conflict) throw new BadRequestException('Ce lien Secret est déjà utilisé.');
      data.slug = slug;
    }

    const updated = await this.prisma.secretPage.update({
      where: { id: page.id },
      data
    });

    return {
      ...this.serializeOwnerPage(updated),
      links: this.pageLinks(updated.slug)
    };
  }

  async createCampaign(ownerId: string, dto: CreateSecretCampaignDto) {
    const page = await this.ensurePage(ownerId);
    if (!page.enabled) {
      throw new BadRequestException('Active KnowMe Secret avant de partager une question.');
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('La date d’expiration doit être dans le futur.');
    }
    if (expiresAt && expiresAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1_000) {
      throw new BadRequestException('Une question partageable ne peut pas dépasser 30 jours.');
    }

    const category = (dto.category ?? 'QUESTION') as SecretMessageCategory;
    if (!this.acceptedCategories(page.acceptedCategories).includes(category)) {
      throw new BadRequestException('Cette catégorie est désactivée sur ta page Secret.');
    }

    const campaign = await this.prisma.secretCampaign.create({
      data: {
        pageId: page.id,
        token: randomBytes(9).toString('base64url'),
        prompt: dto.prompt.trim(),
        category,
        source: dto.source ?? 'QUESTION_CARD',
        expiresAt,
        maximumMessages: dto.maximumMessages ?? null
      }
    });

    return {
      ...campaign,
      links: this.campaignLinks(page.slug, campaign.token)
    };
  }

  async recordCampaignShare(ownerId: string, campaignId: string) {
    const page = await this.ensurePage(ownerId);
    const campaign = await this.prisma.secretCampaign.findFirst({
      where: { id: campaignId, pageId: page.id }
    });
    if (!campaign) throw new NotFoundException('Question Secret introuvable.');

    const updated = await this.prisma.secretCampaign.update({
      where: { id: campaign.id },
      data: { shareCount: { increment: 1 } }
    });
    return { ...updated, links: this.campaignLinks(page.slug, updated.token) };
  }

  async getPublicPage(
    slugInput: string,
    campaignToken?: string,
    requestedEntryPoint?: string
  ) {
    const slug = normalizeSecretSlug(slugInput);
    const page = await this.prisma.secretPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page Secret introuvable.');

    const campaign = campaignToken
      ? await this.prisma.secretCampaign.findFirst({
          where: { pageId: page.id, token: campaignToken }
        })
      : null;
    if (campaignToken && !campaign) {
      throw new NotFoundException('Question Secret introuvable.');
    }

    const entryPoint = this.normalizeEntryPoint(requestedEntryPoint, campaign ? 'QUESTION_CARD' : 'SHARED_LINK');
    this.checkPublicAccess(page, campaign, entryPoint);

    return {
      slug: page.slug,
      displayName: page.displayName,
      avatarUrl: page.avatarUrl,
      presentation: page.presentation,
      prompt: campaign?.prompt ?? page.defaultPrompt,
      category: campaign?.category ?? 'QUESTION',
      acceptedCategories: this.acceptedCategories(page.acceptedCategories),
      allowUnauthenticatedSenders: page.allowUnauthenticatedSenders,
      challengeRequired: page.requireChallengeVerification,
      publicMessageCount: page.publicMessageCountVisible ? page.messageCount : null,
      campaign: campaign
        ? {
            token: campaign.token,
            expiresAt: campaign.expiresAt,
            remainingResponses:
              campaign.maximumMessages === null
                ? null
                : Math.max(0, campaign.maximumMessages - campaign.messageCount)
          }
        : null,
      entryPoint,
      anonymity: {
        identityVisibleToRecipient: false,
        premiumCanRevealIdentity: false,
        senderCanBeBlockedWithoutBeingIdentified: true
      }
    };
  }

  async submitPublicMessage(
    slugInput: string,
    dto: SubmitSecretMessageDto,
    fingerprint: RequestFingerprint
  ) {
    const slug = normalizeSecretSlug(slugInput);
    const page = await this.prisma.secretPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page Secret introuvable.');

    const campaign = dto.campaignToken
      ? await this.prisma.secretCampaign.findFirst({
          where: { pageId: page.id, token: dto.campaignToken }
        })
      : null;
    if (dto.campaignToken && !campaign) {
      throw new NotFoundException('Question Secret introuvable.');
    }

    const entryPoint = this.normalizeEntryPoint(dto.entryPoint, campaign ? 'QUESTION_CARD' : 'SHARED_LINK');
    this.checkPublicAccess(page, campaign, entryPoint);

    const senderTokenHash = this.senderToken(page.id, fingerprint);
    const [blocked, submissions24h] = await Promise.all([
      this.prisma.secretBlock.findUnique({
        where: { pageId_senderTokenHash: { pageId: page.id, senderTokenHash } }
      }),
      this.prisma.secretMessage.count({
        where: {
          pageId: page.id,
          senderTokenHash,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1_000) },
          status: { not: 'DELETED' }
        }
      })
    ]);

    const category = (dto.category ?? campaign?.category ?? 'QUESTION') as SecretMessageCategory;
    const riskScore = this.moderationRiskScore(dto.content);
    const preferences = this.preferences(page);

    try {
      assertSecretMessageAllowed(
        {
          category,
          content: dto.content,
          senderAuthenticated: false,
          senderAccountAgeHours: null,
          challengeVerificationPassed:
            !page.requireChallengeVerification || Boolean(dto.challengeProof?.trim()),
          moderationPassed: riskScore < 70,
          harassmentRiskScore: riskScore,
          repeatedSubmissionCount24h: submissions24h,
          recipientBlockedSenderToken: Boolean(blocked)
        },
        preferences
      );
    } catch (cause) {
      throw new ForbiddenException(cause instanceof Error ? cause.message : 'Message Secret refusé.');
    }

    if (submissions24h >= page.dailyLimitPerSender) {
      throw new ForbiddenException('Limite quotidienne de messages Secret atteinte.');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.secretMessage.create({
        data: {
          pageId: page.id,
          campaignId: campaign?.id ?? null,
          category,
          content: dto.content.trim(),
          senderTokenHash,
          senderAuthenticated: false,
          moderationRiskScore: riskScore,
          status: 'DELIVERED'
        },
        select: { id: true, category: true, createdAt: true }
      });

      await tx.secretPage.update({
        where: { id: page.id },
        data: { messageCount: { increment: 1 } }
      });
      if (campaign) {
        await tx.secretCampaign.update({
          where: { id: campaign.id },
          data: { messageCount: { increment: 1 } }
        });
      }
      return created;
    });

    await this.notifications.create({
      userId: page.ownerId,
      type: 'SECRET_MESSAGE',
      title: 'Nouveau message anonyme',
      body: campaign ? `Une réponse à « ${campaign.prompt.slice(0, 70)} » est arrivée.` : 'Un nouveau message est arrivé dans KnowMe Secret.',
      data: { route: '/secret', secretMessageId: message.id }
    });

    return {
      accepted: true,
      messageId: message.id,
      deliveredAt: message.createdAt,
      identityVisibleToRecipient: false
    };
  }

  async inbox(ownerId: string, limit = 50) {
    const page = await this.ensurePage(ownerId);
    return this.prisma.secretMessage.findMany({
      where: { pageId: page.id, status: { not: 'DELETED' } },
      include: {
        campaign: { select: { prompt: true, token: true } },
        reply: true
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100)
    });
  }

  async openMessage(ownerId: string, messageId: string) {
    const message = await this.ownerMessage(ownerId, messageId);
    return this.prisma.secretMessage.update({
      where: { id: message.id },
      data: { openedAt: message.openedAt ?? new Date() }
    });
  }

  async archiveMessage(ownerId: string, messageId: string) {
    const message = await this.ownerMessage(ownerId, messageId);
    return this.prisma.secretMessage.update({
      where: { id: message.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() }
    });
  }

  async blockSender(ownerId: string, messageId: string) {
    const message = await this.ownerMessage(ownerId, messageId);
    await this.prisma.$transaction([
      this.prisma.secretBlock.upsert({
        where: {
          pageId_senderTokenHash: {
            pageId: message.pageId,
            senderTokenHash: message.senderTokenHash
          }
        },
        create: {
          pageId: message.pageId,
          senderTokenHash: message.senderTokenHash,
          reason: 'Blocage depuis la boîte Secret'
        },
        update: {}
      }),
      this.prisma.secretMessage.updateMany({
        where: { pageId: message.pageId, senderTokenHash: message.senderTokenHash },
        data: { status: 'BLOCKED' }
      })
    ]);
    return { blocked: true, identityRevealed: false };
  }

  async reply(ownerId: string, messageId: string, dto: SecretReplyDto) {
    const message = await this.ownerMessage(ownerId, messageId);
    const reply = await this.prisma.secretPublicReply.upsert({
      where: { messageId: message.id },
      create: {
        messageId: message.id,
        answer: dto.answer.trim(),
        visibility: dto.visibility ?? 'PUBLIC',
        shareCaption: dto.shareCaption?.trim() || null
      },
      update: {
        answer: dto.answer.trim(),
        visibility: dto.visibility ?? 'PUBLIC',
        shareCaption: dto.shareCaption?.trim() || null
      }
    });
    return {
      ...reply,
      shareCard: {
        question: message.content,
        answer: reply.answer,
        route: `/secret/replies/${reply.id}`
      }
    };
  }

  private async ensurePage(ownerId: string) {
    const existing = await this.prisma.secretPage.findUnique({ where: { ownerId } });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { username: true, displayName: true, avatarUrl: true }
    });
    if (!user) throw new NotFoundException('Compte introuvable.');

    let slug = normalizeSecretSlug(user.username);
    const conflict = await this.prisma.secretPage.findUnique({ where: { slug }, select: { id: true } });
    if (conflict) slug = `${slug.slice(0, 21)}-${randomBytes(3).toString('hex')}`;

    return this.prisma.secretPage.create({
      data: {
        ownerId,
        slug,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        enabled: false
      }
    });
  }

  private async ownerMessage(ownerId: string, messageId: string) {
    const page = await this.ensurePage(ownerId);
    const message = await this.prisma.secretMessage.findFirst({
      where: { id: messageId, pageId: page.id }
    });
    if (!message) throw new NotFoundException('Message Secret introuvable.');
    return message;
  }

  private preferences(page: {
    enabled: boolean;
    acceptedCategories: string;
    minimumAccountAgeHours: number;
    allowUnauthenticatedSenders: boolean;
    requireChallengeVerification: boolean;
    blockedTerms: unknown;
  }): SecretInboxPreferences {
    const categories = this.acceptedCategories(page.acceptedCategories);
    const blockedTerms = Array.isArray(page.blockedTerms)
      ? page.blockedTerms.filter((term): term is string => typeof term === 'string')
      : [];
    return {
      enabled: page.enabled,
      acceptQuestions: categories.includes('QUESTION'),
      acceptCompliments: categories.includes('COMPLIMENT'),
      acceptConfessions: categories.includes('CONFESSION'),
      acceptFeedback: categories.includes('FEEDBACK'),
      minimumAccountAgeHours: page.minimumAccountAgeHours,
      allowUnauthenticatedSenders: page.allowUnauthenticatedSenders,
      requireChallengeVerification: page.requireChallengeVerification,
      blockedTerms,
      deliveryDelaySeconds: 0
    };
  }

  private acceptedCategories(value: string): SecretMessageCategory[] {
    return value
      .split(',')
      .map((category) => category.trim())
      .filter((category): category is SecretMessageCategory =>
        ['QUESTION', 'COMPLIMENT', 'CONFESSION', 'FEEDBACK'].includes(category)
      );
  }

  private checkPublicAccess(
    page: {
      enabled: boolean;
      profileEntryEnabled: boolean;
      pausedUntil: Date | null;
    },
    campaign: {
      status: 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED';
      expiresAt: Date | null;
      maximumMessages: number | null;
      messageCount: number;
    } | null,
    entryPoint: SecretEntryPoint
  ) {
    try {
      assertSecretPublicAccess({
        pageEnabled: page.enabled,
        profileEntryEnabled: page.profileEntryEnabled,
        entryPoint,
        pausedUntil: page.pausedUntil,
        campaignStatus: campaign?.status ?? null,
        campaignExpiresAt: campaign?.expiresAt ?? null,
        campaignMaximumMessages: campaign?.maximumMessages ?? null,
        campaignMessageCount: campaign?.messageCount ?? 0
      });
    } catch (cause) {
      throw new ForbiddenException(cause instanceof Error ? cause.message : 'Page Secret indisponible.');
    }
  }

  private normalizeEntryPoint(value: string | undefined, fallback: SecretEntryPoint): SecretEntryPoint {
    return [
      'DEDICATED_APP',
      'PUBLIC_PROFILE_CTA',
      'SHARED_LINK',
      'QUESTION_CARD',
      'STATUS_OR_STORY',
      'QR_CODE',
      'DEEP_LINK'
    ].includes(value ?? '')
      ? (value as SecretEntryPoint)
      : fallback;
  }

  private senderToken(pageId: string, fingerprint: RequestFingerprint): string {
    const secret =
      this.config.get<string>('SECRET_SENDER_TOKEN_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'knowme-secret-development-only';
    const material = [pageId, fingerprint.ip ?? 'unknown', fingerprint.userAgent ?? 'unknown', fingerprint.acceptLanguage ?? 'unknown'].join('|');
    return createHmac('sha256', secret).update(material).digest('hex');
  }

  private moderationRiskScore(content: string): number {
    const normalized = content.toLocaleLowerCase('fr');
    const severe = [
      /tue[- ]?toi/,
      /je vais te tuer/,
      /je vais te violer/,
      /adresse.*maison/,
      /kill yourself/,
      /i will kill you/
    ];
    if (severe.some((pattern) => pattern.test(normalized))) return 95;
    const hostile = [/sale (?:pute|con|idiot)/, /personne ne t'aime/, /tu es inutile/, /harc[eè]lement/];
    if (hostile.some((pattern) => pattern.test(normalized))) return 75;
    return 0;
  }

  private pageLinks(slug: string) {
    return {
      public: `/secret/${slug}`,
      canonical: `knowme.app/secret/${slug}`,
      deepLink: `knowme://secret/${slug}`,
      profileEntry: `/profile/${slug}#knowme-secret`
    };
  }

  private campaignLinks(slug: string, token: string) {
    return {
      public: `/secret/${slug}?question=${token}`,
      canonical: `knowme.app/secret/${slug}?question=${token}`,
      deepLink: `knowme://secret/${slug}?question=${token}`
    };
  }

  private serializeOwnerPage(page: {
    id: string;
    slug: string;
    displayName: string;
    avatarUrl: string | null;
    presentation: string;
    defaultPrompt: string;
    enabled: boolean;
    profileEntryEnabled: boolean;
    allowUnauthenticatedSenders: boolean;
    requireChallengeVerification: boolean;
    minimumAccountAgeHours: number;
    dailyLimitPerSender: number;
    acceptedCategories: string;
    blockedTerms: unknown;
    pausedUntil: Date | null;
    publicMessageCountVisible: boolean;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...page,
      acceptedCategories: this.acceptedCategories(page.acceptedCategories),
      blockedTerms: Array.isArray(page.blockedTerms) ? page.blockedTerms : []
    };
  }
}
