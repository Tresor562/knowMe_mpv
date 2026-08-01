import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join, resolve, sep } from 'path';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVerificationRequestDto,
  ReviewVerificationDto
} from './dto/verification.dto';
import { toVerifiedBadge } from './verification-profile';

const ACTIVE_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'NEEDS_INFO'
] as const;

const USER_EDITABLE_STATUSES = new Set(['DRAFT', 'NEEDS_INFO']);
const USER_CANCELLABLE_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'NEEDS_INFO']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf'
]);
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

@Injectable()
export class VerificationService {
  private readonly privateRoot = resolve(
    process.env.VERIFICATION_PRIVATE_DIR ??
      join(process.cwd(), 'private', 'verification')
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async me(userId: string) {
    const [request, identity] = await Promise.all([
      this.prisma.verificationRequest.findFirst({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          documents: {
            where: { deletedAt: null },
            select: {
              id: true,
              kind: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true
            },
            orderBy: { uploadedAt: 'asc' }
          },
          decisions: {
            select: {
              id: true,
              action: true,
              reasonCode: true,
              userMessage: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      this.prisma.verifiedIdentity.findUnique({ where: { userId } })
    ]);

    return {
      request,
      badge: toVerifiedBadge(identity),
      identityStatus: this.publicIdentityStatus(identity)
    };
  }

  async createRequest(userId: string, dto: CreateVerificationRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

    try {
      const request = await this.prisma.verificationRequest.create({
        data: {
          userId,
          activeKey: `active:${userId}`,
          subjectType: dto.subjectType,
          countryCode: dto.countryCode,
          publicCategory: dto.publicCategory,
          publicReason: dto.publicReason?.trim() || null,
          termsVersion: dto.termsVersion.trim()
        }
      });

      await this.audit.record({
        actorId: userId,
        action: 'VERIFICATION_REQUEST_CREATE',
        entity: 'VerificationRequest',
        entityId: request.id,
        targetAccountId: userId,
        metadata: {
          subjectType: request.subjectType,
          publicCategory: request.publicCategory,
          countryCode: request.countryCode,
          termsVersion: request.termsVersion
        }
      });

      return request;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Une demande de certification est déjà active pour ce compte.'
        );
      }
      throw error;
    }
  }

  async uploadDocument(
    userId: string,
    requestId: string,
    kind: string,
    file?: Express.Multer.File
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Document absent ou invalide.');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Type de document non autorisé.');
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
      throw new BadRequestException('Le document dépasse la taille autorisée.');
    }

    const request = await this.ownedRequest(userId, requestId);
    if (!USER_EDITABLE_STATUSES.has(request.status)) {
      throw new BadRequestException(
        'Les documents ne peuvent plus être modifiés à cette étape.'
      );
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.verificationDocument.findFirst({
      where: { requestId, sha256, deletedAt: null },
      select: { id: true }
    });
    if (duplicate) {
      throw new ConflictException('Ce document a déjà été ajouté à la demande.');
    }

    const extension = this.extensionFor(file.mimetype);
    const storageKey = `${requestId}/${randomUUID()}${extension}`;
    const absolutePath = this.privatePath(storageKey);
    await mkdir(resolve(absolutePath, '..'), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx', mode: 0o600 });

    try {
      const document = await this.prisma.verificationDocument.create({
        data: {
          requestId,
          kind,
          storageKey,
          sha256,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalNameHash: file.originalname
            ? createHash('sha256').update(file.originalname).digest('hex')
            : null
        },
        select: {
          id: true,
          kind: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true
        }
      });

      await this.audit.record({
        actorId: userId,
        action: 'VERIFICATION_DOCUMENT_UPLOAD',
        entity: 'VerificationDocument',
        entityId: document.id,
        targetAccountId: userId,
        metadata: {
          requestId,
          kind,
          mimeType: file.mimetype,
          sizeBytes: file.size
        }
      });

      return document;
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ce document a déjà été ajouté à la demande.');
      }
      throw error;
    }
  }

  async deleteDocument(userId: string, requestId: string, documentId: string) {
    const request = await this.ownedRequest(userId, requestId);
    if (!USER_EDITABLE_STATUSES.has(request.status)) {
      throw new BadRequestException(
        'Les documents ne peuvent plus être modifiés à cette étape.'
      );
    }

    const document = await this.prisma.verificationDocument.findFirst({
      where: { id: documentId, requestId, deletedAt: null }
    });
    if (!document) throw new NotFoundException('Document introuvable.');

    await this.prisma.verificationDocument.update({
      where: { id: document.id },
      data: { deletedAt: new Date() }
    });
    await unlink(this.privatePath(document.storageKey)).catch(() => undefined);

    await this.audit.record({
      actorId: userId,
      action: 'VERIFICATION_DOCUMENT_DELETE',
      entity: 'VerificationDocument',
      entityId: document.id,
      targetAccountId: userId,
      metadata: { requestId, kind: document.kind }
    });

    return { deleted: true };
  }

  async submit(userId: string, requestId: string) {
    const request = await this.prisma.verificationRequest.findFirst({
      where: { id: requestId, userId },
      include: {
        documents: {
          where: { deletedAt: null },
          select: { kind: true }
        }
      }
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    if (!USER_EDITABLE_STATUSES.has(request.status)) {
      throw new BadRequestException('Cette demande ne peut pas être soumise.');
    }

    const kinds = new Set(request.documents.map((document) => document.kind));
    const missing = this.requiredKinds(request.subjectType).filter(
      (kind) => !kinds.has(kind)
    );
    if (missing.length) {
      throw new BadRequestException(
        `Documents requis manquants : ${missing.join(', ')}.`
      );
    }

    const updated = await this.prisma.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        reviewStartedAt: null
      }
    });

    await this.audit.record({
      actorId: userId,
      action: 'VERIFICATION_REQUEST_SUBMIT',
      entity: 'VerificationRequest',
      entityId: request.id,
      targetAccountId: userId,
      metadata: {
        subjectType: request.subjectType,
        documentKinds: [...kinds]
      }
    });

    return updated;
  }

  async cancel(userId: string, requestId: string) {
    const request = await this.ownedRequest(userId, requestId);
    if (!USER_CANCELLABLE_STATUSES.has(request.status)) {
      throw new BadRequestException('Cette demande ne peut plus être annulée.');
    }

    const updated = await this.prisma.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: 'CANCELLED',
        activeKey: null,
        cancelledAt: new Date(),
        resolvedAt: new Date()
      }
    });

    await this.audit.record({
      actorId: userId,
      action: 'VERIFICATION_REQUEST_CANCEL',
      entity: 'VerificationRequest',
      entityId: request.id,
      targetAccountId: userId
    });

    return updated;
  }

  async adminQueue(status?: string) {
    const requests = await this.prisma.verificationRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        documents: {
          where: { deletedAt: null },
          select: { id: true, kind: true, mimeType: true, sizeBytes: true }
        },
        identity: true
      },
      orderBy: [
        { submittedAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' }
      ],
      take: 100
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: requests.map((request) => request.userId) } },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return requests.map((request) => ({
      ...request,
      user: usersById.get(request.userId) ?? null
    }));
  }

  async adminDetail(requestId: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: {
        documents: {
          where: { deletedAt: null },
          select: {
            id: true,
            kind: true,
            sha256: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true
          },
          orderBy: { uploadedAt: 'asc' }
        },
        decisions: { orderBy: { createdAt: 'desc' } },
        identity: true
      }
    });
    if (!request) throw new NotFoundException('Demande introuvable.');

    const user = await this.prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    return { ...request, user };
  }

  async startReview(reviewerId: string, requestId: string) {
    const result = await this.prisma.verificationRequest.updateMany({
      where: { id: requestId, status: 'SUBMITTED' },
      data: { status: 'IN_REVIEW', reviewStartedAt: new Date() }
    });
    if (!result.count) {
      throw new ConflictException(
        'La demande n’est plus disponible pour commencer un examen.'
      );
    }

    await this.audit.record({
      actorId: reviewerId,
      action: 'VERIFICATION_REVIEW_START',
      entity: 'VerificationRequest',
      entityId: requestId
    });

    return this.adminDetail(requestId);
  }

  async review(
    reviewerId: string,
    requestId: string,
    dto: ReviewVerificationDto
  ) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: { identity: true }
    });
    if (!request) throw new NotFoundException('Demande introuvable.');

    const now = new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= now) {
      throw new BadRequestException('La date d’expiration doit être future.');
    }

    let identityStatus: string | null = request.identity?.status ?? null;
    let requestStatus = request.status;

    await this.prisma.$transaction(async (tx) => {
      if (dto.action === 'NEEDS_INFO') {
        this.assertStatus(request.status, ['IN_REVIEW'], dto.action);
        requestStatus = 'NEEDS_INFO';
        await tx.verificationRequest.update({
          where: { id: request.id },
          data: { status: requestStatus, reviewStartedAt: null }
        });
      } else if (dto.action === 'APPROVE') {
        this.assertStatus(request.status, ['IN_REVIEW'], dto.action);
        requestStatus = 'APPROVED';
        identityStatus = 'ACTIVE';
        await tx.verificationRequest.update({
          where: { id: request.id },
          data: {
            status: requestStatus,
            activeKey: null,
            resolvedAt: now
          }
        });
        await tx.verifiedIdentity.upsert({
          where: { userId: request.userId },
          create: {
            userId: request.userId,
            requestId: request.id,
            status: 'ACTIVE',
            badgeLabel: dto.badgeLabel?.trim() || 'Compte certifié',
            category: request.publicCategory,
            verifiedAt: now,
            expiresAt,
            reviewedById: reviewerId
          },
          update: {
            requestId: request.id,
            status: 'ACTIVE',
            badgeLabel: dto.badgeLabel?.trim() || 'Compte certifié',
            category: request.publicCategory,
            verifiedAt: now,
            expiresAt,
            suspendedAt: null,
            revokedAt: null,
            revocationReason: null,
            reviewedById: reviewerId
          }
        });
      } else if (dto.action === 'REJECT') {
        this.assertStatus(request.status, ['IN_REVIEW'], dto.action);
        requestStatus = 'REJECTED';
        await tx.verificationRequest.update({
          where: { id: request.id },
          data: {
            status: requestStatus,
            activeKey: null,
            resolvedAt: now
          }
        });
      } else if (dto.action === 'SUSPEND') {
        if (!request.identity || request.identity.status !== 'ACTIVE') {
          throw new BadRequestException('Aucun badge actif à suspendre.');
        }
        identityStatus = 'SUSPENDED';
        await tx.verifiedIdentity.update({
          where: { id: request.identity.id },
          data: { status: 'SUSPENDED', suspendedAt: now }
        });
      } else if (dto.action === 'REVOKE') {
        if (
          !request.identity ||
          !['ACTIVE', 'SUSPENDED'].includes(request.identity.status)
        ) {
          throw new BadRequestException('Aucun badge actif à révoquer.');
        }
        identityStatus = 'REVOKED';
        await tx.verifiedIdentity.update({
          where: { id: request.identity.id },
          data: {
            status: 'REVOKED',
            revokedAt: now,
            revocationReason: dto.reasonCode
          }
        });
      }

      await tx.verificationDecision.create({
        data: {
          requestId: request.id,
          reviewerId,
          action: dto.action,
          reasonCode: dto.reasonCode.trim().toUpperCase(),
          userMessage: dto.userMessage?.trim() || null,
          internalNote: dto.internalNote?.trim() || null
        }
      });
    });

    await this.audit.record({
      actorId: reviewerId,
      action: `VERIFICATION_${dto.action}`,
      entity: 'VerificationRequest',
      entityId: request.id,
      targetAccountId: request.userId,
      metadata: {
        reasonCode: dto.reasonCode.trim().toUpperCase(),
        requestStatus,
        identityStatus,
        expiresAt: expiresAt?.toISOString() ?? null
      }
    });

    await this.notifications.create({
      userId: request.userId,
      type: `VERIFICATION_${dto.action}`,
      title: this.notificationTitle(dto.action),
      body: dto.userMessage?.trim() || this.notificationBody(dto.action),
      data: {
        route: '/verification',
        entityType: 'VERIFICATION_REQUEST',
        entityId: request.id
      }
    });

    return this.adminDetail(request.id);
  }

  async readPrivateDocument(requestId: string, documentId: string) {
    const document = await this.prisma.verificationDocument.findFirst({
      where: { id: documentId, requestId, deletedAt: null }
    });
    if (!document) throw new NotFoundException('Document introuvable.');

    try {
      return {
        buffer: await readFile(this.privatePath(document.storageKey)),
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        fileName: `verification-${document.kind.toLowerCase()}${this.extensionFor(document.mimeType)}`
      };
    } catch {
      throw new NotFoundException('Le fichier privé est indisponible.');
    }
  }

  private async ownedRequest(userId: string, requestId: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId }
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    if (request.userId !== userId) {
      throw new ForbiddenException('Accès interdit à cette demande.');
    }
    return request;
  }

  private requiredKinds(subjectType: string) {
    return subjectType === 'ORGANIZATION'
      ? ['REGISTRATION', 'AUTHORIZATION']
      : ['IDENTITY_FRONT', 'SELFIE'];
  }

  private extensionFor(mimeType: string) {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'application/pdf') return '.pdf';
    return extname(mimeType).slice(0, 8);
  }

  private privatePath(storageKey: string) {
    const candidate = resolve(this.privateRoot, storageKey);
    if (
      candidate !== this.privateRoot &&
      !candidate.startsWith(`${this.privateRoot}${sep}`)
    ) {
      throw new BadRequestException('Clé de stockage privée invalide.');
    }
    return candidate;
  }

  private assertStatus(current: string, allowed: string[], action: string) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `Action ${action} impossible depuis le statut ${current}.`
      );
    }
  }

  private publicIdentityStatus(identity: {
    status: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
  } | null) {
    if (!identity) return 'UNVERIFIED';
    if (identity.status === 'ACTIVE' && identity.expiresAt && identity.expiresAt <= new Date()) {
      return 'EXPIRED';
    }
    return identity.status;
  }

  private notificationTitle(action: string) {
    return {
      NEEDS_INFO: 'Informations supplémentaires requises',
      APPROVE: 'Compte certifié',
      REJECT: 'Demande de certification refusée',
      SUSPEND: 'Certification suspendue',
      REVOKE: 'Certification révoquée'
    }[action] ?? 'Mise à jour de la certification';
  }

  private notificationBody(action: string) {
    return {
      NEEDS_INFO: 'L’équipe KnowMe attend des documents ou précisions supplémentaires.',
      APPROVE: 'Ton identité a été vérifiée. Le badge certifié est maintenant actif.',
      REJECT: 'Ta demande ne répond pas encore aux critères de certification.',
      SUSPEND: 'Ton badge certifié a été suspendu pendant un nouvel examen.',
      REVOKE: 'Ton badge certifié a été retiré.'
    }[action] ?? 'Le statut de ta certification a changé.';
  }
}
