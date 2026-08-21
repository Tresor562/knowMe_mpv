import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

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
