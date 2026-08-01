import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from './request-context.service';

export type AuditRecord = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  targetAccountId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RequestContextService
  ) {}

  record(record: AuditRecord) {
    const request = this.context.get();

    return this.prisma.auditLog.create({
      data: {
        actorId: record.actorId ?? null,
        action: record.action,
        entity: record.entity,
        entityId: record.entityId ?? null,
        targetAccountId: record.targetAccountId ?? null,
        requestId: request?.requestId ?? null,
        correlationId: request?.correlationId ?? null,
        ipAddress: request?.ipAddress?.slice(0, 128) ?? null,
        userAgent: request?.userAgent?.slice(0, 500) ?? null,
        metadata: record.metadata
      }
    });
  }
}
