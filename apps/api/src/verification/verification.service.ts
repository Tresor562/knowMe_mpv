import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DecideIdentityVerificationDto,
  StartIdentityReviewDto,
  SubmitIdentityVerificationDto,
  WithdrawIdentityVerificationDto
} from './dto/verification.dto';

const PENDING_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
const ADMIN_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVOKED',
  'EXPIRED',
  'WITHDRAWN'
];

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  async submit(userId: string, dto: SubmitIdentityVerificationDto) {
    const now = new Date();
    const active = await this.prisma.identityVerificationRequest.findFirst({
      where: {
        userId,
        OR: [
          { status: { in: PENDING_STATUSES } },
          { status: 'APPROVED', expiresAt: { gt: now } }
        ]
      },
      orderBy: { submittedAt: 'desc' }
    });

    if (active) {
      throw new ConflictException(
        active.status === 'APPROVED'
          ? 'Ton identité est déjà vérifiée et encore valide.'
          : 'Une demande de vérification est déjà en cours.'
      );
    }

    const normalizedEvidence = dto.evidence.map((item) => ({
      type: item.type,
      provider: item.provider.trim().toUpperCase(),
      opaqueReference: item.opaqueReference.trim(),
      digest: item.digest.trim().toLowerCase(),
      metadata: item.metadata as Prisma.InputJsonValue | undefined
    }));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const request = await this.prisma.$transaction(
          async (tx) => {
            const latest = await tx.identityVerificationRequest.aggregate({
              where: { userId },
              _max: { submissionNumber: true }
            });
            const submissionNumber =
              (latest._max.submissionNumber ?? 0) + 1;

            const created = await tx.identityVerificationRequest.create({
              data: {
                userId,
                submissionNumber,
                status: 'SUBMITTED',
                level: 'IDENTITY',
                displayNameClaim: dto.displayNameClaim?.trim() || null,
                countryCode: dto.countryCode?.trim().toUpperCase() || null,
                evidenceCount: normalizedEvidence.length,
                evidence: { create: normalizedEvidence },
                decisions: {
                  create: {
                    action: 'SUBMIT',
                    previousStatus: 'NONE',
                    nextStatus: 'SUBMITTED',
                    reason: 'Demande soumise par le titulaire du compte.'
                  }
                }
              },
              include: this.requestInclude()
            });

            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: 'IDENTITY_VERIFICATION_SUBMIT',
                entity: 'IdentityVerificationRequest',
                entityId: created.id,
                targetAccountId: userId,
                metadata: {
                  submissionNumber,
                  countryCode: created.countryCode,
                  evidenceCount: created.evidenceCount,
                  evidenceProviders: normalizedEvidence.map(
                    (item) => item.provider
                  )
                }
              }
            });

            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return request;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Une référence de preuve a déjà été utilisée ou une soumission concurrente existe.'
          );
        }
        throw error;
      }
    }

    throw new ConflictException('Soumission concurrente, réessaie.');
  }

  me(userId: string) {
    return this.prisma.identityVerificationRequest.findMany({
      where: { userId },
      include: this.requestInclude(),
      orderBy: { submittedAt: 'desc' }
    });
  }

  async withdraw(
    userId: string,
    requestId: string,
    dto: WithdrawIdentityVerificationDto
  ) {
    const existing = await this.prisma.identityVerificationRequest.findUnique({
      where: { id: requestId }
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Demande de vérification introuvable.');
    }
    if (existing.status === 'WITHDRAWN') {
      return this.getRequest(requestId);
    }
    if (!PENDING_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        'Seule une demande en attente peut être retirée.'
      );
    }

    const reason = dto.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.identityVerificationRequest.updateMany({
        where: {
          id: requestId,
          userId,
          status: { in: PENDING_STATUSES },
          decisionVersion: existing.decisionVersion
        },
        data: {
          status: 'WITHDRAWN',
          withdrawnAt: new Date(),
          decidedAt: new Date(),
          decisionReason: reason,
          decisionVersion: { increment: 1 }
        }
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'La demande a été modifiée simultanément. Recharge son état.'
        );
      }

      await tx.identityVerificationDecision.create({
        data: {
          requestId,
          action: 'WITHDRAW',
          previousStatus: existing.status,
          nextStatus: 'WITHDRAWN',
          reason
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'IDENTITY_VERIFICATION_WITHDRAW',
          entity: 'IdentityVerificationRequest',
          entityId: requestId,
          targetAccountId: userId,
          metadata: { previousStatus: existing.status, reason }
        }
      });
    });

    return this.getRequest(requestId);
  }

  async listAdmin(status?: string) {
    const normalized = status?.trim().toUpperCase();
    if (normalized && !ADMIN_STATUSES.includes(normalized)) {
      throw new BadRequestException('Statut de vérification invalide.');
    }

    return this.prisma.identityVerificationRequest.findMany({
      where: normalized ? { status: normalized } : undefined,
      include: this.adminRequestInclude(),
      orderBy: [{ status: 'asc' }, { submittedAt: 'asc' }],
      take: 250
    });
  }

  async startReview(
    reviewerId: string,
    requestId: string,
    dto: StartIdentityReviewDto
  ) {
    const existing = await this.requireRequest(requestId);
    if (
      existing.status === 'UNDER_REVIEW' &&
      existing.reviewerId === reviewerId
    ) {
      return this.getAdminRequest(requestId);
    }
    if (existing.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'Cette demande ne peut plus être prise en charge.'
      );
    }
    this.assertVersion(existing.decisionVersion, dto.expectedDecisionVersion);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.identityVerificationRequest.updateMany({
        where: {
          id: requestId,
          status: 'SUBMITTED',
          decisionVersion: dto.expectedDecisionVersion
        },
        data: {
          status: 'UNDER_REVIEW',
          reviewerId,
          reviewStartedAt: new Date(),
          decisionVersion: { increment: 1 }
        }
      });
      if (updated.count !== 1) this.throwConcurrentReview();

      await tx.identityVerificationDecision.create({
        data: {
          requestId,
          reviewerId,
          action: 'START_REVIEW',
          previousStatus: 'SUBMITTED',
          nextStatus: 'UNDER_REVIEW',
          reason: 'Demande prise en charge par un examinateur autorisé.'
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          action: 'IDENTITY_VERIFICATION_REVIEW_START',
          entity: 'IdentityVerificationRequest',
          entityId: requestId,
          targetAccountId: existing.userId,
          metadata: { decisionVersion: dto.expectedDecisionVersion + 1 }
        }
      });
    });

    return this.getAdminRequest(requestId);
  }

  approve(
    reviewerId: string,
    requestId: string,
    dto: DecideIdentityVerificationDto
  ) {
    return this.decide(reviewerId, requestId, 'APPROVED', dto);
  }

  reject(
    reviewerId: string,
    requestId: string,
    dto: DecideIdentityVerificationDto
  ) {
    return this.decide(reviewerId, requestId, 'REJECTED', dto);
  }

  revoke(
    reviewerId: string,
    requestId: string,
    dto: DecideIdentityVerificationDto
  ) {
    return this.decide(reviewerId, requestId, 'REVOKED', dto);
  }

  async expireDue(reviewerId: string) {
    const due = await this.prisma.identityVerificationRequest.findMany({
      where: {
        status: 'APPROVED',
        expiresAt: { lte: new Date() }
      },
      select: {
        id: true,
        userId: true,
        decisionVersion: true,
        expiresAt: true
      },
      take: 500
    });

    let expired = 0;
    for (const item of due) {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.identityVerificationRequest.updateMany({
          where: {
            id: item.id,
            status: 'APPROVED',
            decisionVersion: item.decisionVersion,
            expiresAt: { lte: new Date() }
          },
          data: {
            status: 'EXPIRED',
            decidedAt: new Date(),
            decisionReason: 'Durée de validité arrivée à échéance.',
            decisionVersion: { increment: 1 }
          }
        });
        if (updated.count !== 1) return false;

        await tx.identityVerificationDecision.create({
          data: {
            requestId: item.id,
            reviewerId,
            action: 'EXPIRE',
            previousStatus: 'APPROVED',
            nextStatus: 'EXPIRED',
            reason: 'Durée de validité arrivée à échéance.',
            expiresAt: item.expiresAt
          }
        });
        await tx.auditLog.create({
          data: {
            actorId: reviewerId,
            action: 'IDENTITY_VERIFICATION_EXPIRE',
            entity: 'IdentityVerificationRequest',
            entityId: item.id,
            targetAccountId: item.userId,
            metadata: { expiresAt: item.expiresAt?.toISOString() ?? null }
          }
        });
        return true;
      });
      if (result) expired += 1;
    }

    return { examined: due.length, expired };
  }

  private async decide(
    reviewerId: string,
    requestId: string,
    nextStatus: 'APPROVED' | 'REJECTED' | 'REVOKED',
    dto: DecideIdentityVerificationDto
  ) {
    const existing = await this.requireRequest(requestId);
    if (existing.status === nextStatus) {
      return this.getAdminRequest(requestId);
    }

    if (nextStatus === 'REVOKED') {
      if (existing.status !== 'APPROVED') {
        throw new BadRequestException(
          'Seule une identité approuvée peut être révoquée.'
        );
      }
    } else {
      if (existing.status !== 'UNDER_REVIEW') {
        throw new BadRequestException(
          'La demande doit être en cours d’examen avant décision.'
        );
      }
      if (existing.reviewerId !== reviewerId) {
        throw new ForbiddenException(
          'Seul l’examinateur ayant pris en charge la demande peut décider.'
        );
      }
    }

    this.assertVersion(existing.decisionVersion, dto.expectedDecisionVersion);
    const reason = dto.reason.trim();
    const now = new Date();
    const expiresAt =
      nextStatus === 'APPROVED'
        ? new Date(
            now.getTime() +
              (dto.expiresInDays ?? 365) * 24 * 60 * 60 * 1000
          )
        : nextStatus === 'REVOKED'
          ? now
          : null;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.identityVerificationRequest.updateMany({
        where: {
          id: requestId,
          status: existing.status,
          decisionVersion: dto.expectedDecisionVersion
        },
        data: {
          status: nextStatus,
          reviewerId,
          decidedAt: now,
          expiresAt,
          decisionReason: reason,
          decisionVersion: { increment: 1 }
        }
      });
      if (updated.count !== 1) this.throwConcurrentReview();

      await tx.identityVerificationDecision.create({
        data: {
          requestId,
          reviewerId,
          action: nextStatus,
          previousStatus: existing.status,
          nextStatus,
          reason,
          expiresAt
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          action: `IDENTITY_VERIFICATION_${nextStatus}`,
          entity: 'IdentityVerificationRequest',
          entityId: requestId,
          targetAccountId: existing.userId,
          metadata: {
            previousStatus: existing.status,
            nextStatus,
            reason,
            expiresAt: expiresAt?.toISOString() ?? null,
            decisionVersion: dto.expectedDecisionVersion + 1
          }
        }
      });
    });

    await this.notifications.create({
      userId: existing.userId,
      type: `IDENTITY_VERIFICATION_${nextStatus}`,
      title:
        nextStatus === 'APPROVED'
          ? 'Identité vérifiée'
          : nextStatus === 'REVOKED'
            ? 'Vérification révoquée'
            : 'Demande de vérification refusée',
      body:
        nextStatus === 'APPROVED'
          ? 'Ton badge Identité vérifiée est maintenant actif.'
          : reason,
      data: {
        route: '/verification',
        entityType: 'IDENTITY_VERIFICATION',
        entityId: requestId,
        status: nextStatus
      }
    });

    await this.audit.record({
      actorId: reviewerId,
      action: 'IDENTITY_VERIFICATION_NOTIFICATION_SENT',
      entity: 'IdentityVerificationRequest',
      entityId: requestId,
      targetAccountId: existing.userId,
      metadata: { status: nextStatus }
    });

    return this.getAdminRequest(requestId);
  }

  private requireRequest(requestId: string) {
    return this.prisma.identityVerificationRequest
      .findUnique({ where: { id: requestId } })
      .then((request) => {
        if (!request) {
          throw new NotFoundException('Demande de vérification introuvable.');
        }
        return request;
      });
  }

  private getRequest(requestId: string) {
    return this.prisma.identityVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: this.requestInclude()
    });
  }

  private getAdminRequest(requestId: string) {
    return this.prisma.identityVerificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: this.adminRequestInclude()
    });
  }

  private requestInclude() {
    return {
      evidence: {
        select: {
          id: true,
          type: true,
          provider: true,
          opaqueReference: true,
          digest: true,
          metadata: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' as const }
      },
      decisions: {
        select: {
          id: true,
          action: true,
          previousStatus: true,
          nextStatus: true,
          reason: true,
          expiresAt: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' as const }
      }
    };
  }

  private adminRequestInclude() {
    return {
      applicant: {
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true
        }
      },
      reviewer: {
        select: { id: true, username: true, displayName: true }
      },
      evidence: {
        orderBy: { createdAt: 'asc' as const }
      },
      decisions: {
        include: {
          reviewer: {
            select: { id: true, username: true, displayName: true }
          }
        },
        orderBy: { createdAt: 'asc' as const }
      }
    };
  }

  private assertVersion(current: number, expected: number) {
    if (current !== expected) this.throwConcurrentReview();
  }

  private throwConcurrentReview(): never {
    throw new ConflictException(
      'La demande a changé depuis son chargement. Actualise la file avant de continuer.'
    );
  }
}
