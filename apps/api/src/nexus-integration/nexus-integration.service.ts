import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type Risk = 'read' | 'write' | 'destructive';
type Approval = 'none' | 'user' | 'operator';
type Capability = { id: string; risk: Risk; scope: string; approval: Approval };
type Actor = {
  nexusUserId: string;
  knowMeUserId?: string;
  requestedBy: 'user' | 'founder' | 'system-policy';
};
type IntegrationRequest = {
  requestId: string;
  capabilityId: string;
  actor: Actor;
  target?: { type: string; id: string };
  arguments: Record<string, unknown>;
  idempotencyKey?: string;
  approvalId?: string;
  reason?: string;
  dryRun?: boolean;
  grantedScopes: string[];
};

const CAPABILITIES: readonly Capability[] = [
  { id: 'application.status.read', risk: 'read', scope: 'knowme:application:read', approval: 'none' },
  { id: 'application.release.verify', risk: 'read', scope: 'knowme:application:read', approval: 'none' },
  { id: 'application.features.read', risk: 'read', scope: 'knowme:application:read', approval: 'none' },
  { id: 'application.features.write', risk: 'write', scope: 'knowme:application:write', approval: 'user' },
  { id: 'accounts.profile.read', risk: 'read', scope: 'knowme:accounts:read', approval: 'none' },
  { id: 'accounts.support.write', risk: 'write', scope: 'knowme:accounts:write', approval: 'user' },
  { id: 'accounts.restrict', risk: 'destructive', scope: 'knowme:accounts:destructive', approval: 'operator' },
  { id: 'games.catalog.read', risk: 'read', scope: 'knowme:games:read', approval: 'none' },
  { id: 'games.session.read', risk: 'read', scope: 'knowme:games:read', approval: 'none' },
  { id: 'security.alerts.read', risk: 'read', scope: 'knowme:security:read', approval: 'none' },
  { id: 'avatars.read', risk: 'read', scope: 'knowme:avatars:read', approval: 'none' },
  { id: 'moderation.queue.read', risk: 'read', scope: 'knowme:moderation:read', approval: 'none' },
  { id: 'messaging.context.read', risk: 'read', scope: 'knowme:messaging:read', approval: 'none' },
  { id: 'groups.context.read', risk: 'read', scope: 'knowme:groups:read', approval: 'none' }
] as const;

const CAPABILITY = new Map(CAPABILITIES.map((item) => [item.id, item]));
const MAX_ARGUMENT_BYTES = 50_000;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING = 8_000;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,119}$/;
const FORBIDDEN_KEY = /(?:^|[_.-])(sql|database|credential|password|passwd|secret|token|privatekey|shell|script|command|rawquery)(?:$|[_.-])/i;

@Injectable()
export class NexusIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly audit: AuditService
  ) {}

  status() {
    return {
      enabled: this.enabled(),
      version: 'knowme-nexus-os-v1',
      capabilities: CAPABILITIES.map((item) => ({ ...item }))
    };
  }

  async execute(raw: unknown) {
    if (!this.enabled()) {
      throw new ServiceUnavailableException({
        code: 'NEXUS_INTEGRATION_DISABLED',
        message: 'Nexus integration is disabled by the KnowMe kill switch.'
      });
    }
    const request = this.validate(raw);
    const capability = CAPABILITY.get(request.capabilityId)!;

    const previous = await this.prisma.nexusIntegrationReceipt.findUnique({
      where: { requestId: request.requestId }
    });
    if (previous) return this.replay(previous);
    if (request.idempotencyKey) {
      const replay = await this.prisma.nexusIntegrationReceipt.findUnique({
        where: {
          capabilityId_idempotencyKey: {
            capabilityId: request.capabilityId,
            idempotencyKey: request.idempotencyKey
          }
        }
      });
      if (replay) return this.replay(replay);
    }

    if (request.dryRun === true && capability.risk !== 'read') {
      return this.persist(request, capability, 'completed', {
        dryRun: true,
        executable: this.hasHandler(capability.id),
        capability: capability.id
      });
    }

    try {
      const result = await this.dispatch(request, capability);
      return await this.persist(request, capability, 'completed', result);
    } catch (error) {
      await this.persist(request, capability, 'failed', {
        error: error instanceof Error ? error.message.slice(0, 500) : 'execution failed'
      }).catch(() => undefined);
      throw error;
    }
  }

  private enabled() {
    return process.env.NEXUS_INTEGRATION_ENABLED === 'true';
  }

  private validate(raw: unknown): IntegrationRequest {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('A Nexus integration request object is required.');
    }
    const input = raw as Record<string, unknown>;
    const requestId = this.text(input.requestId, 120);
    const capabilityId = this.text(input.capabilityId, 160);
    const capability = CAPABILITY.get(capabilityId);
    if (!/^[A-Za-z0-9_-]{12,120}$/.test(requestId)) {
      throw new BadRequestException('Invalid requestId.');
    }
    if (!capability) {
      throw new BadRequestException({ code: 'NEXUS_CAPABILITY_UNSUPPORTED', message: 'This KnowMe capability is not executable.' });
    }

    const actorRaw = input.actor && typeof input.actor === 'object' && !Array.isArray(input.actor)
      ? input.actor as Record<string, unknown>
      : {};
    const requestedBy = actorRaw.requestedBy === 'user' || actorRaw.requestedBy === 'founder' || actorRaw.requestedBy === 'system-policy'
      ? actorRaw.requestedBy
      : null;
    const actor: Actor = {
      nexusUserId: this.text(actorRaw.nexusUserId, 160),
      knowMeUserId: this.text(actorRaw.knowMeUserId, 160) || undefined,
      requestedBy: requestedBy ?? 'user'
    };
    if (!actor.nexusUserId || !requestedBy) throw new BadRequestException('Invalid Nexus actor.');

    const grantedScopes = Array.isArray(input.grantedScopes)
      ? input.grantedScopes.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean).slice(0, 50)
      : [];
    if (!grantedScopes.includes(capability.scope)) {
      throw new ForbiddenException({ code: 'NEXUS_SCOPE_DENIED', message: `Missing required scope ${capability.scope}.` });
    }

    const idempotencyKey = this.text(input.idempotencyKey, 160) || undefined;
    const approvalId = this.text(input.approvalId, 160) || undefined;
    const reason = this.text(input.reason, 1_000) || undefined;
    if (capability.risk !== 'read') {
      if (!idempotencyKey || !/^[A-Za-z0-9_.:-]{16,160}$/.test(idempotencyKey)) throw new BadRequestException('Mutations require an idempotencyKey.');
      if (!approvalId || !/^[A-Za-z0-9_-]{12,160}$/.test(approvalId)) throw new BadRequestException('Mutations require an approvalId.');
    }
    if (capability.approval === 'operator') {
      if (!reason || reason.length < 10) throw new BadRequestException('Operator actions require a meaningful reason.');
      const operators = this.operatorIds();
      if (!operators.has(actor.nexusUserId)) throw new ForbiddenException({ code: 'NEXUS_OPERATOR_REQUIRED', message: 'This action requires an allowlisted Nexus operator.' });
    }

    let target: IntegrationRequest['target'];
    if (input.target !== undefined) {
      if (!input.target || typeof input.target !== 'object' || Array.isArray(input.target)) throw new BadRequestException('Invalid target.');
      const row = input.target as Record<string, unknown>;
      const type = this.text(row.type, 80);
      const id = this.text(row.id, 200);
      if (!SAFE_KEY.test(type) || !id) throw new BadRequestException('Invalid target.');
      target = { type, id };
    }

    const args = this.sanitizeArguments(input.arguments);
    return {
      requestId,
      capabilityId,
      actor,
      target,
      arguments: args,
      idempotencyKey,
      approvalId,
      reason,
      dryRun: input.dryRun === true,
      grantedScopes
    };
  }

  private async dispatch(request: IntegrationRequest, capability: Capability): Promise<unknown> {
    switch (capability.id) {
      case 'application.status.read':
        return { ok: true, service: 'KnowMe API', integrationVersion: 'v1', now: new Date().toISOString() };
      case 'application.release.verify':
        return { ready: true, gates: ['server-authoritative-actions', 'idempotency-receipts', 'audit-log', 'kill-switch'], note: 'Deployment health and external provider checks remain environment-specific.' };
      case 'application.features.read':
        return (await this.flags.listAdmin()).slice(0, 100).map((flag) => ({ key: flag.key, enabled: flag.enabled, riskLevel: flag.riskLevel, exposeToClient: flag.exposeToClient, reviewAt: flag.reviewAt }));
      case 'application.features.write': {
        const key = this.requiredString(request.arguments.key, 'key', 120);
        if (typeof request.arguments.enabled !== 'boolean') throw new BadRequestException('enabled must be boolean.');
        const updated = await this.flags.update(request.actor.knowMeUserId ?? request.actor.nexusUserId, key, { enabled: request.arguments.enabled });
        return { key: updated.key, enabled: updated.enabled };
      }
      case 'accounts.profile.read': {
        const id = this.targetId(request, 'user');
        const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, role: true, isSuspended: true, createdAt: true } });
        if (!user) throw new NotFoundException('User not found.');
        this.assertSelfOrOperator(request, id);
        return user;
      }
      case 'accounts.support.write': {
        const id = this.targetId(request, 'user');
        this.assertSelfOrOperator(request, id);
        const operation = this.requiredString(request.arguments.operation, 'operation', 80);
        if (operation !== 'revoke_sessions') throw new BadRequestException('Only revoke_sessions is supported.');
        const result = await this.prisma.authSession.deleteMany({ where: { userId: id } });
        return { operation, userId: id, revokedSessions: result.count };
      }
      case 'accounts.restrict': {
        const id = this.targetId(request, 'user');
        const operation = this.requiredString(request.arguments.operation, 'operation', 80);
        if (operation !== 'suspend' && operation !== 'restore') throw new BadRequestException('Only suspend/restore are supported.');
        const updated = await this.prisma.user.update({ where: { id }, data: { isSuspended: operation === 'suspend' }, select: { id: true, isSuspended: true } });
        if (operation === 'suspend') await this.prisma.authSession.deleteMany({ where: { userId: id } });
        return { ...updated, operation };
      }
      case 'games.catalog.read':
        return this.prisma.gameDefinition.findMany({ where: { status: 'ACTIVE' }, select: { id: true, key: true, version: true, name: true, description: true, engineKey: true, minPlayers: true, maxPlayers: true }, orderBy: [{ key: 'asc' }, { version: 'desc' }], take: 100 });
      case 'games.session.read': {
        const id = this.targetId(request, 'gameSession');
        const session = await this.prisma.gameSession.findUnique({ where: { id } });
        if (!session) throw new NotFoundException('Game session not found.');
        const userId = request.actor.knowMeUserId;
        if (userId && session.ownerId !== userId) {
          const participant = await this.prisma.gameParticipant.findUnique({ where: { sessionId_userId: { sessionId: id, userId } }, select: { userId: true } });
          if (!participant && !this.isOperator(request.actor.nexusUserId)) throw new ForbiddenException('Game session access denied.');
        }
        return { id: session.id, definitionKey: session.definitionKey, definitionVersion: session.definitionVersion, ownerId: session.ownerId, status: session.status, sequence: session.sequence, currentTurnPosition: session.currentTurnPosition, winnerUserId: session.winnerUserId, expiresAt: session.expiresAt, startedAt: session.startedAt, completedAt: session.completedAt, updatedAt: session.updatedAt };
      }
      case 'security.alerts.read':
        if (!this.isOperator(request.actor.nexusUserId)) throw new ForbiddenException('Security alerts require an operator.');
        return this.prisma.auditLog.findMany({ where: { action: { contains: 'SECURITY', mode: 'insensitive' } }, select: { id: true, action: true, entity: true, entityId: true, targetAccountId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      case 'avatars.read': {
        const id = this.targetId(request, 'user');
        this.assertSelfOrOperator(request, id);
        const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, avatarUrl: true } });
        if (!user) throw new NotFoundException('User not found.');
        return user;
      }
      case 'moderation.queue.read':
        if (!this.isOperator(request.actor.nexusUserId)) throw new ForbiddenException('Moderation queue requires an operator.');
        return this.prisma.report.findMany({ select: { id: true, reason: true, status: true, targetType: true, targetId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      case 'messaging.context.read':
      case 'groups.context.read': {
        const conversationId = this.targetId(request, 'conversation');
        const userId = request.actor.knowMeUserId;
        if (!userId) throw new ForbiddenException('A linked KnowMe user is required for conversation context.');
        const membership = await this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { conversationId: true, conversation: { select: { id: true, title: true, isGroup: true } } } });
        if (!membership) throw new ForbiddenException('Conversation membership required.');
        if (capability.id === 'groups.context.read' && !membership.conversation.isGroup) throw new BadRequestException('Target is not a group conversation.');
        const messages = await this.prisma.message.findMany({ where: { conversationId }, select: { id: true, senderId: true, content: true, createdAt: true, editedAt: true }, orderBy: { createdAt: 'desc' }, take: 30 });
        return { conversation: membership.conversation, messages: messages.reverse() };
      }
      default:
        throw new BadRequestException({ code: 'NEXUS_CAPABILITY_UNSUPPORTED', message: 'No authoritative handler exists for this capability.' });
    }
  }

  private hasHandler(id: string) {
    return CAPABILITY.has(id);
  }

  private async persist(request: IntegrationRequest, capability: Capability, outcome: string, result: unknown) {
    const response = this.json(result);
    const receipt = await this.prisma.nexusIntegrationReceipt.create({
      data: {
        requestId: request.requestId,
        capabilityId: capability.id,
        actorNexusUserId: request.actor.nexusUserId,
        actorKnowMeUserId: request.actor.knowMeUserId,
        risk: capability.risk,
        idempotencyKey: request.idempotencyKey,
        approvalId: request.approvalId,
        outcome,
        response
      }
    });
    await this.audit.record({
      actorId: request.actor.knowMeUserId ?? request.actor.nexusUserId,
      action: 'NEXUS_INTEGRATION_ACTION',
      entity: 'NexusIntegrationReceipt',
      entityId: receipt.id,
      targetAccountId: request.target?.type === 'user' ? request.target.id : undefined,
      metadata: { capabilityId: capability.id, risk: capability.risk, outcome, requestId: request.requestId, approvalId: request.approvalId ?? null }
    });
    return { replayed: false, receiptId: receipt.id, requestId: request.requestId, capabilityId: capability.id, outcome, result };
  }

  private replay(receipt: { id: string; requestId: string; capabilityId: string; outcome: string; response: Prisma.JsonValue | null }) {
    return { replayed: true, receiptId: receipt.id, requestId: receipt.requestId, capabilityId: receipt.capabilityId, outcome: receipt.outcome, result: receipt.response };
  }

  private assertSelfOrOperator(request: IntegrationRequest, targetUserId: string) {
    if (request.actor.knowMeUserId === targetUserId || this.isOperator(request.actor.nexusUserId)) return;
    throw new ForbiddenException('User boundary denied.');
  }

  private isOperator(nexusUserId: string) {
    return this.operatorIds().has(nexusUserId);
  }

  private operatorIds() {
    try {
      const parsed = JSON.parse(process.env.NEXUS_KNOWME_OPERATOR_NEXUS_IDS_JSON ?? '[]');
      return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : []);
    } catch {
      return new Set<string>();
    }
  }

  private targetId(request: IntegrationRequest, type: string) {
    if (!request.target || request.target.type !== type || !request.target.id) throw new BadRequestException(`A ${type} target is required.`);
    return request.target.id;
  }

  private requiredString(value: unknown, name: string, max: number) {
    const text = this.text(value, max);
    if (!text) throw new BadRequestException(`${name} is required.`);
    return text;
  }

  private sanitizeArguments(value: unknown): Record<string, unknown> {
    const sanitized = value && typeof value === 'object' && !Array.isArray(value)
      ? this.sanitize(value, 0) as Record<string, unknown>
      : {};
    if (Buffer.byteLength(JSON.stringify(sanitized), 'utf8') > MAX_ARGUMENT_BYTES) throw new BadRequestException('Arguments exceed 50 KB.');
    return sanitized;
  }

  private sanitize(value: unknown, depth: number): unknown {
    if (depth > MAX_DEPTH) throw new BadRequestException('Arguments are too deeply nested.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new BadRequestException('Non-finite number rejected.');
      return value;
    }
    if (typeof value === 'string') return value.slice(0, MAX_STRING);
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS) throw new BadRequestException('Too many array items.');
      return value.map((item) => this.sanitize(item, depth + 1));
    }
    if (!value || typeof value !== 'object') throw new BadRequestException('Unsupported argument value.');
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (!SAFE_KEY.test(key) || FORBIDDEN_KEY.test(key)) throw new BadRequestException(`Argument key is not allowed: ${key.slice(0, 80)}`);
      out[key] = this.sanitize(item, depth + 1);
    }
    return out;
  }

  private text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }
}
