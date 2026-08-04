import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  TooManyRequestsException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CallsService } from './calls.service';

const MAX_ISSUES_PER_WINDOW = 12;
const ISSUE_WINDOW_MS = 10 * 60 * 1_000;

@Injectable()
export class CallIceService {
  constructor(
    private readonly config: ConfigService,
    private readonly calls: CallsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async issue(userId: string, callId: string) {
    const call = await this.calls.view(userId, callId);
    if (!['RINGING', 'ACTIVE'].includes(call.status)) {
      throw new ForbiddenException({
        code: 'CALL_ICE_NOT_AVAILABLE',
        message: 'La configuration réseau n’est disponible que pour un appel vivant.'
      });
    }

    const recentIssues = await this.prisma.callEvent.count({
      where: {
        callId,
        actorId: userId,
        action: 'ICE_CONFIGURATION_ISSUED',
        createdAt: { gt: new Date(Date.now() - ISSUE_WINDOW_MS) }
      }
    });
    if (recentIssues >= MAX_ISSUES_PER_WINDOW) {
      throw new TooManyRequestsException({
        code: 'CALL_ICE_RATE_LIMITED',
        message: 'Trop de configurations réseau ont été demandées récemment.'
      });
    }

    const stunUrls = this.urls('CALL_STUN_URLS_JSON');
    const turnUrls = this.urls('CALL_TURN_URLS_JSON');
    const turnSecret = this.config.get<string>('CALL_TURN_SECRET')?.trim() ?? '';
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const requireTurn =
      this.config.get<string>('CALL_REQUIRE_TURN_IN_PRODUCTION') !== 'false';

    if (production && requireTurn && (!turnUrls.length || !turnSecret)) {
      throw new ServiceUnavailableException({
        code: 'CALL_TURN_NOT_CONFIGURED',
        message: 'Le relais sécurisé des appels n’est pas configuré.'
      });
    }
    if (!stunUrls.length && (!turnUrls.length || !turnSecret)) {
      throw new ServiceUnavailableException({
        code: 'CALL_ICE_NOT_CONFIGURED',
        message: 'Aucun serveur ICE n’est configuré.'
      });
    }

    const ttlSeconds = this.integer('CALL_TURN_TTL_SECONDS', 600, 60, 3_600);
    const expiresUnix = Math.floor(Date.now() / 1_000) + ttlSeconds;
    const username = `${expiresUnix}:${userId}:${callId}`;
    const credential = turnSecret
      ? createHmac('sha1', turnSecret).update(username).digest('base64')
      : null;

    const iceServers: RTCIceServer[] = [];
    if (stunUrls.length) iceServers.push({ urls: stunUrls });
    if (turnUrls.length && credential) {
      iceServers.push({
        urls: turnUrls,
        username,
        credential,
        credentialType: 'password'
      });
    }

    const fingerprint = createHash('sha256')
      .update(`${callId}:${userId}:${expiresUnix}:${turnUrls.join(',')}`)
      .digest('hex');
    await this.prisma.callEvent.create({
      data: {
        callId,
        actorId: userId,
        action: 'ICE_CONFIGURATION_ISSUED',
        metadata: {
          expiresUnix,
          ttlSeconds,
          stunConfigured: stunUrls.length > 0,
          turnConfigured: turnUrls.length > 0 && Boolean(credential),
          credentialFingerprint: fingerprint
        }
      }
    });
    await this.audit.record({
      actorId: userId,
      action: 'CALL_ICE_CONFIGURATION_ISSUED',
      entity: 'CallSession',
      entityId: callId,
      metadata: {
        expiresUnix,
        turnConfigured: turnUrls.length > 0 && Boolean(credential),
        credentialFingerprint: fingerprint
      }
    });

    return {
      callId,
      iceServers,
      expiresAt: new Date(expiresUnix * 1_000).toISOString(),
      policy: {
        ephemeralCredentials: Boolean(credential),
        ttlSeconds,
        secretExposed: false,
        persistedCredential: false,
        productionTurnRequired: requireTurn
      }
    };
  }

  private urls(name: string) {
    const raw = this.config.get<string>(name)?.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return [
        ...new Set(
          parsed
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => /^(stun|stuns|turn|turns):/i.test(value))
        )
      ].slice(0, 8);
    } catch {
      return [];
    }
  }

  private integer(name: string, fallback: number, minimum: number, maximum: number) {
    const parsed = Number.parseInt(this.config.get<string>(name) ?? '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
  }
}
