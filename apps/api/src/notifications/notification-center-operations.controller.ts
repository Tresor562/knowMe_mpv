import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationCenterDigestSchedulerService } from './notification-center-digest-scheduler.service';
import { NotificationCenterDigestService } from './notification-center-digest.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/notification-center')
export class AdminNotificationCenterOperationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly digests: NotificationCenterDigestService,
    private readonly scheduler: NotificationCenterDigestSchedulerService
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [digest, preferences, states, receipts] = await Promise.all([
      this.digests.dashboard(),
      this.prisma.notificationCenterPreference.count(),
      this.prisma.notificationCenterUserState.count(),
      this.prisma.notificationCenterActionReceipt.count()
    ]);
    return {
      digest,
      scheduler: this.scheduler.status(),
      totals: { preferences, states, receipts },
      transportOwnership: {
        orchestration: 'KMD-046',
        resilience: 'KMD-047',
        duplicateEndpointRegistryCreated: false
      },
      serverTime: new Date()
    };
  }

  @Post('digest/flush')
  flush() {
    return this.digests.flushDue();
  }

  @Post('scheduler/tick')
  tick() {
    return this.scheduler.tick();
  }

  @Post('maintenance/cleanup')
  async cleanup() {
    const now = new Date();
    const processedBefore = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const auditBefore = new Date(now.getTime() - 180 * 24 * 60 * 60_000);
    const [queue, receipts, batches] = await this.prisma.$transaction([
      this.prisma.notificationCenterDigestQueueItem.deleteMany({
        where: { status: 'PROCESSED', processedAt: { lt: processedBefore } }
      }),
      this.prisma.notificationCenterActionReceipt.deleteMany({
        where: { createdAt: { lt: auditBefore } }
      }),
      this.prisma.notificationCenterDigestBatch.deleteMany({
        where: { createdAt: { lt: auditBefore } }
      })
    ]);
    return {
      deleted: {
        processedQueueItems: queue.count,
        actionReceipts: receipts.count,
        digestBatches: batches.count
      },
      retention: {
        processedQueueDays: 30,
        auditReceiptDays: 180
      },
      serverTime: now
    };
  }
}
