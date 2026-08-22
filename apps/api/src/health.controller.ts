import { Headers, Controller, Get, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { getRuntimeHttpMetricsSnapshot } from './common/http-observability';
import { PrismaService } from './prisma/prisma.service';

const METRICS_TOKEN_MIN_LENGTH = 32;

export function hasMetricsAccess(authorization: string | undefined, configuredToken: string | undefined): boolean {
  const expected = configuredToken?.trim();
  if (!expected || expected.length < METRICS_TOKEN_MIN_LENGTH) return false;
  if (!authorization?.startsWith('Bearer ')) return false;

  const candidate = authorization.slice('Bearer '.length);
  const expectedBytes = Buffer.from(expected, 'utf8');
  const candidateBytes = Buffer.from(candidate, 'utf8');
  if (candidateBytes.length !== expectedBytes.length) return false;

  return timingSafeEqual(candidateBytes, expectedBytes);
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return this.livePayload();
  }

  @Get('live')
  getLiveness() {
    return this.livePayload();
  }

  @Get('metrics')
  getMetrics(@Headers('authorization') authorization?: string) {
    const metricsToken = process.env.METRICS_BEARER_TOKEN;
    if (!metricsToken || metricsToken.trim().length < METRICS_TOKEN_MIN_LENGTH) {
      throw new ServiceUnavailableException({
        status: 'metrics_unavailable',
        service: 'knowme-api'
      });
    }
    if (!hasMetricsAccess(authorization, metricsToken)) {
      throw new UnauthorizedException({
        status: 'unauthorized',
        service: 'knowme-api'
      });
    }

    return {
      service: 'knowme-api',
      uptimeSeconds: Math.floor(process.uptime()),
      http: getRuntimeHttpMetricsSnapshot()
    };
  }

  @Get('ready')
  async getReadiness() {
    const timestamp = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ready',
        service: 'knowme-api',
        timestamp,
        checks: { database: 'up' }
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'knowme-api',
        timestamp,
        checks: { database: 'down' }
      });
    }
  }

  private livePayload() {
    return {
      status: 'ok',
      service: 'knowme-api',
      timestamp: new Date().toISOString(),
      checks: { process: 'up' }
    };
  }
}
