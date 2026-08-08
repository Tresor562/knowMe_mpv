import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  TooManyRequestsException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NexusPlan = 'free' | 'plus' | 'pro' | 'business';
type NexusMode = 'instant' | 'think';

export type KnowMeNexusEntitlement = {
  linked: boolean;
  plan: NexusPlan;
  status: 'active' | 'inactive';
  knowMe: {
    hourlyTurns: number;
    maxContextMessages: number;
    maxReplyChars: number;
    modes: NexusMode[];
  };
  capabilities: {
    knowMePrivateChat: true;
    knowMeThink: boolean;
  };
  verifiedAt: string;
};

type NexusEntitlementResponse = {
  linked?: unknown;
  nexusUserId?: unknown;
  entitlement?: {
    plan?: unknown;
    status?: unknown;
    capabilities?: Record<string, unknown>;
    knowMe?: Record<string, unknown>;
  };
  verifiedAt?: unknown;
  error?: unknown;
};

const UNLINKED: Omit<KnowMeNexusEntitlement, 'verifiedAt'> = {
  linked: false,
  plan: 'free',
  status: 'active',
  capabilities: { knowMePrivateChat: true, knowMeThink: false },
  knowMe: { hourlyTurns: 12, maxContextMessages: 12, maxReplyChars: 6_000, modes: ['instant'] }
};

const LINKED_FREE: Omit<KnowMeNexusEntitlement, 'verifiedAt'> = {
  linked: true,
  plan: 'free',
  status: 'active',
  capabilities: { knowMePrivateChat: true, knowMeThink: true },
  knowMe: { hourlyTurns: 30, maxContextMessages: 20, maxReplyChars: 12_000, modes: ['instant', 'think'] }
};

@Injectable()
export class NexusEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async statusForUser(userId: string): Promise<KnowMeNexusEntitlement> {
    const link = await this.prisma.nexusAccountLink.findUnique({ where: { knowMeUserId: userId } });
    if (!link) return { ...UNLINKED, verifiedAt: new Date().toISOString() };
    try {
      const resolved = await this.callNexus({ action: 'resolve', nexusUserId: link.nexusUserId });
      const parsed = this.parseNexusEntitlement(resolved, true);
      await this.prisma.nexusAccountLink.update({
        where: { knowMeUserId: userId },
        data: {
          lastPlan: parsed.entitlement.plan,
          lastStatus: parsed.entitlement.status,
          verifiedAt: new Date(parsed.verifiedAt)
        }
      });
      return parsed.entitlement;
    } catch {
      // Subscription authority unavailable: never preserve stale paid authorization.
      return { ...LINKED_FREE, verifiedAt: new Date().toISOString() };
    }
  }

  async linkAccount(userId: string, rawCode: unknown): Promise<KnowMeNexusEntitlement> {
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) throw new BadRequestException('Code de liaison Nexus invalide.');
    const payload = await this.callNexus({ action: 'consume-link', code, knowMeUserId: userId });
    const parsed = this.parseNexusEntitlement(payload, true);
    await this.prisma.nexusAccountLink.upsert({
      where: { knowMeUserId: userId },
      create: {
        knowMeUserId: userId,
        nexusUserId: parsed.nexusUserId,
        lastPlan: parsed.entitlement.plan,
        lastStatus: parsed.entitlement.status,
        verifiedAt: new Date(parsed.verifiedAt)
      },
      update: {
        nexusUserId: parsed.nexusUserId,
        lastPlan: parsed.entitlement.plan,
        lastStatus: parsed.entitlement.status,
        verifiedAt: new Date(parsed.verifiedAt)
      }
    });
    return parsed.entitlement;
  }

  async unlinkAccount(userId: string) {
    await this.prisma.nexusAccountLink.deleteMany({ where: { knowMeUserId: userId } });
    return { linked: false, entitlement: { ...UNLINKED, verifiedAt: new Date().toISOString() } };
  }

  async authorizeConversationTurn(userId: string, conversationId: string, requestedMode: NexusMode) {
    const privateSurface = await this.prisma.nexusSocialConversation.findUnique({
      where: { conversationId },
      select: { ownerUserId: true }
    });
    if (!privateSurface) return null;
    if (privateSurface.ownerUserId !== userId) throw new BadRequestException('Conversation Nexus privée invalide.');

    const entitlement = await this.statusForUser(userId);
    if (!entitlement.knowMe.modes.includes(requestedMode)) {
      throw new BadRequestException(
        entitlement.linked
          ? `Le mode ${requestedMode} n'est pas inclus dans le profil Nexus actuel.`
          : 'Connectez un compte Nexus pour utiliser le mode Think dans KnowMe.'
      );
    }
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const used = await this.prisma.nexusSocialReply.count({
      where: { invokingUserId: userId, surface: 'private', createdAt: { gte: since } }
    });
    if (used >= entitlement.knowMe.hourlyTurns) throw new TooManyRequestsException('Quota horaire Nexus dans KnowMe atteint.');
    return entitlement;
  }

  private parseNexusEntitlement(payload: NexusEntitlementResponse, requireLinked: boolean) {
    const plan = payload.entitlement?.plan;
    const status = payload.entitlement?.status;
    const knowMe = payload.entitlement?.knowMe;
    const capabilities = payload.entitlement?.capabilities;
    const nexusUserId = typeof payload.nexusUserId === 'string' ? payload.nexusUserId : '';
    const verifiedAt = typeof payload.verifiedAt === 'string' ? payload.verifiedAt : '';
    const hourlyTurns = Number(knowMe?.hourlyTurns);
    const maxContextMessages = Number(knowMe?.maxContextMessages);
    const maxReplyChars = Number(knowMe?.maxReplyChars);
    const modes = Array.isArray(knowMe?.modes)
      ? knowMe.modes.filter((mode): mode is NexusMode => mode === 'instant' || mode === 'think')
      : [];
    if (
      (requireLinked && payload.linked !== true) ||
      !['free', 'plus', 'pro', 'business'].includes(String(plan)) ||
      !['active', 'inactive'].includes(String(status)) ||
      !nexusUserId || !verifiedAt || !Number.isFinite(Date.parse(verifiedAt)) ||
      !Number.isInteger(hourlyTurns) || hourlyTurns < 1 || hourlyTurns > 10_000 ||
      !Number.isInteger(maxContextMessages) || maxContextMessages < 1 || maxContextMessages > 30 ||
      !Number.isInteger(maxReplyChars) || maxReplyChars < 1 || maxReplyChars > 30_000 ||
      modes.length === 0 || capabilities?.knowMePrivateChat !== true || typeof capabilities?.knowMeThink !== 'boolean'
    ) throw new BadGatewayException('Nexus a retourné un profil d’abonnement invalide.');

    const entitlement: KnowMeNexusEntitlement = {
      linked: true,
      plan: plan as NexusPlan,
      status: status as 'active' | 'inactive',
      knowMe: {
        hourlyTurns,
        maxContextMessages,
        maxReplyChars,
        modes
      },
      capabilities: { knowMePrivateChat: true, knowMeThink: capabilities.knowMeThink as boolean },
      verifiedAt
    };
    return { nexusUserId, verifiedAt, entitlement };
  }

  private async callNexus(body: Record<string, unknown>): Promise<NexusEntitlementResponse> {
    const endpoint = this.entitlementEndpoint();
    const secret = process.env.NEXUS_KNOWME_SHARED_SECRET?.trim() ?? '';
    if (secret.length < 32) throw new ServiceUnavailableException('Nexus shared secret is not configured.');
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000)
      });
    } catch (error) {
      throw new BadGatewayException(error instanceof Error ? error.message : 'Nexus entitlement request failed.');
    }
    const payload = await response.json().catch(() => ({})) as NexusEntitlementResponse;
    if (!response.ok) {
      const detail = typeof payload.error === 'string' ? payload.error.slice(0, 400) : `Nexus returned HTTP ${response.status}.`;
      throw new BadGatewayException(detail);
    }
    return payload;
  }

  private entitlementEndpoint() {
    const configured = process.env.NEXUS_SERVER_URL?.trim() ?? '';
    if (!configured) throw new ServiceUnavailableException('NEXUS_SERVER_URL is not configured.');
    let url: URL;
    try { url = new URL(configured); } catch { throw new ServiceUnavailableException('NEXUS_SERVER_URL is invalid.'); }
    if (url.username || url.password || url.search || url.hash) {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL must not contain credentials, query parameters or fragments.');
    }
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL must use HTTPS in production.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new ServiceUnavailableException('NEXUS_SERVER_URL must use HTTP(S).');
    }
    return new URL('/api/integrations/knowme/entitlements', `${url.origin}/`).toString();
  }
}
