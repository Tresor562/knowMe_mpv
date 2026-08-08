import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { NexusIntegrationService } from './nexus-integration.service';

@Controller('internal/nexus')
export class NexusIntegrationController {
  constructor(private readonly nexus: NexusIntegrationService) {}

  @Get('status')
  status(@Headers('authorization') authorization?: string) {
    this.authorize(authorization);
    return this.nexus.status();
  }

  @Post('actions')
  execute(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown
  ) {
    this.authorize(authorization);
    return this.nexus.execute(body);
  }

  private authorize(header?: string) {
    const configured = process.env.NEXUS_KNOWME_SHARED_SECRET?.trim() ?? '';
    const supplied = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (configured.length < 32 || !supplied || !this.constantTimeEqual(configured, supplied)) {
      throw new UnauthorizedException('Unauthorized Nexus integration request.');
    }
  }

  private constantTimeEqual(left: string, right: string) {
    const a = Buffer.from(left, 'utf8');
    const b = Buffer.from(right, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
