import {
  BadRequestException, ConflictException, Injectable, NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

// Declarative, fixed-schema presentation. Never evaluate downloaded JavaScript or HTML.
type Badge = { key: string; label: string; color: string; symbol: 'check' | 'star' | 'spark' };
type Module = { key: string; title: string; kind: 'notice' | 'link' | 'tile'; href?: string };
type Document = { badges: Badge[]; modules: Module[] };
const RESERVED = new Set(['verified_blue', 'staff_gold']);
const DEFAULT: Document = {
  badges: [
    { key: 'verified_blue', label: 'Compte certifié KnowMe', color: '#1877F2', symbol: 'check' },
    { key: 'staff_gold', label: 'Équipe KnowMe', color: '#E5AD31', symbol: 'check' }
  ],
  modules: []
};
const KEY = /^[a-z][a-z0-9_-]{1,49}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_PATH = /^\/(?!\/)(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Configuration invalide.');
  }
  return value as Record<string, unknown>;
}
function short(value: unknown, max: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
export function validateRuntimeDocument(input: unknown): Document {
  const value = object(input);
  if (!Array.isArray(value.badges) || !Array.isArray(value.modules)
      || value.badges.length > 100 || value.modules.length > 40) {
    throw new BadRequestException('Catalogue de badges ou modules invalide.');
  }
  const keys = new Set<string>();
  const badges = value.badges.map((raw) => {
    const row = object(raw);
    if (!short(row.key, 50) || !KEY.test(row.key as string)
      || !short(row.label, 80) || !COLOR.test(String(row.color))
      || !['check', 'star', 'spark'].includes(String(row.symbol))
      || keys.has(row.key as string)) {
      throw new BadRequestException('Définition de badge invalide ou dupliquée.');
    }
    keys.add(row.key as string);
    return { key: row.key as string, label: (row.label as string).trim(),
      color: row.color as string, symbol: row.symbol as Badge['symbol'] };
  });
  // Reserved official identities may be styled but never created via cosmetic grants.
  const moduleKeys = new Set<string>();
  const modules = value.modules.map((raw) => {
    const row = object(raw);
    if (!short(row.key, 50) || !KEY.test(row.key as string)
      || moduleKeys.has(row.key as string) || !short(row.title, 100)
      || !['notice', 'link', 'tile'].includes(String(row.kind))) {
      throw new BadRequestException('Module de présentation invalide.');
    }
    const href = row.href;
    if (href !== undefined && (typeof href !== 'string'
        || !SAFE_PATH.test(href) || href.length > 120 || href.includes('..'))) {
      throw new BadRequestException('Seules les routes internes KnowMe sont autorisées.');
    }
    if (row.kind === 'link' && !href) {
      throw new BadRequestException('Un lien doit contenir une route interne.');
    }
    moduleKeys.add(row.key as string);
    return { key: row.key as string, title: (row.title as string).trim(),
      kind: row.kind as Module['kind'], ...(href ? { href } : {}) };
  });
  return { badges, modules };
}
@Injectable()
export class RuntimeExperienceService {
  constructor(private readonly prisma: PrismaService,
    private readonly audit: AuditService, private readonly realtime: RealtimeGateway) {}

  async read() {
    const row = await this.prisma.runtimeExperienceConfig.findUnique({ where: { id: 'global' } });
    return { revision: row?.revision ?? 0, document: row?.document ?? DEFAULT };
  }

  async publish(actorId: string, input: unknown) {
    const value = object(input);
    const expected = value.expectedRevision;
    if (!Number.isSafeInteger(expected) || (expected as number) < 0) {
      throw new BadRequestException('expectedRevision invalide.');
    }
    const document = validateRuntimeDocument(value.document);
    const payload = document as unknown as Prisma.InputJsonValue;
    let revision: number;
    if (expected === 0) {
      try {
        await this.prisma.runtimeExperienceConfig.create({
          data: { id: 'global', revision: 1, document: payload, updatedById: actorId }
        });
        revision = 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('La configuration a été modifiée. Recharge avant de publier.');
        }
        throw error;
      }
    } else {
      const changed = await this.prisma.runtimeExperienceConfig.updateMany({
        where: { id: 'global', revision: expected as number },
        data: { document: payload, revision: { increment: 1 }, updatedById: actorId }
      });
      if (changed.count !== 1) {
        throw new ConflictException('La configuration a été modifiée. Recharge avant de publier.');
      }
      revision = (expected as number) + 1;
    }
    await this.audit.record({ actorId, action: 'RUNTIME_EXPERIENCE_PUBLISH',
      entity: 'RuntimeExperienceConfig', entityId: 'global', metadata: { revision } });
    this.realtime.emitRuntimeExperienceChanged({ revision });
    return { revision, document };
  }

  async badgesForUsername(username: string) {
    const name = username.replace(/^@/, '').trim();
    if (!name || name.length > 80) throw new BadRequestException('Identifiant invalide.');
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: name, mode: 'insensitive' } }, select: { id: true }
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const [config, grants] = await Promise.all([
      this.read(),
      this.prisma.userCosmeticBadge.findMany({
        where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { badgeKey: true }
      })
    ]);
    const allowed = new Set(grants.map(grant => grant.badgeKey));
    const document = config.document as Document;
    return { revision: config.revision, badges: document.badges.filter(
      badge => !RESERVED.has(badge.key) && allowed.has(badge.key)
    ) };
  }

  async changeGrant(actorId: string, input: unknown, revoke = false) {
    const value = object(input);
    const username = String(value.username ?? '').replace(/^@/, '').trim();
    const key = String(value.badgeKey ?? '').trim();
    if (!username || username.length > 80 || !KEY.test(key) || RESERVED.has(key)) {
      throw new BadRequestException('Badge cosmétique ou utilisateur invalide.');
    }
    const [{ document }, user] = await Promise.all([
      this.read(),
      this.prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } },
        select: { id: true, username: true } })
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (!(document as Document).badges.some(badge => badge.key === key)) {
      throw new BadRequestException('Ce badge doit être défini dans le catalogue.');
    }
    if (revoke) {
      await this.prisma.userCosmeticBadge.deleteMany({ where: { userId: user.id, badgeKey: key } });
    } else {
      await this.prisma.userCosmeticBadge.upsert({
        where: { userId_badgeKey: { userId: user.id, badgeKey: key } },
        create: { userId: user.id, badgeKey: key }, update: { expiresAt: null }
      });
    }
    await this.audit.record({ actorId,
      action: revoke ? 'COSMETIC_BADGE_REVOKE' : 'COSMETIC_BADGE_GRANT',
      entity: 'UserCosmeticBadge', entityId: key, targetAccountId: user.id,
      metadata: { badgeKey: key, username: user.username } });
    this.realtime.emitRuntimeBadgeChanged(user.id);
    return { username: user.username, badgeKey: key, granted: !revoke };
  }
}
