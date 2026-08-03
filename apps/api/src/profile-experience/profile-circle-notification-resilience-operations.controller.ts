import {
  Controller,
  Get,
  Injectable,
  Post,
  UseGuards
} from '@nestjs/common';
import { createHash } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationProviderStateService } from './profile-circle-notification-provider-state.service';
import { ProfileCircleNotificationResilienceSchedulerService } from './profile-circle-notification-resilience-scheduler.service';
import { ProfileCircleNotificationPriority } from './profile-circle-notification-resilience.domain';

type OperationalAlertCandidate = {
  code: string;
  severity: ProfileCircleNotificationPriority;
  title: string;
  description: string;
  metadata: Record<string, number>;
};

@Injectable()
export class ProfileCircleNotificationOperationalAlertService {
  constructor(private readonly prisma: PrismaService) {}

  async refresh(now = new Date()) {
    const [openCircuits, openDeadLetters, failedAttempts] = await Promise.all([
      this.prisma.profileCircleNotificationProviderState.count({
        where: { circuitStatus: { in: ['OPEN', 'HALF_OPEN'] } }
      }),
      this.prisma.profileCircleNotificationDeadLetter.count({
        where: { status: { in: ['OPEN', 'REPLAYING'] } }
      }),
      this.prisma.profileCircleNotificationTransportAttempt.count({
        where: { status: 'FAILED' }
      })
    ]);

    const candidates: Array<OperationalAlertCandidate | null> = [
      openCircuits > 0
        ? {
            code: 'PROVIDER_CIRCUIT_OPEN',
            severity: openCircuits >= 3 ? 'CRITICAL' : 'HIGH',
            title: 'Fournisseur de notifications dégradé',
            description: `${openCircuits} circuit(s) fournisseur sont ouverts.`,
            metadata: { openCircuits }
          }
        : null,
      openDeadLetters > 0
        ? {
            code: 'DEAD_LETTERS_OPEN',
            severity: openDeadLetters >= 100 ? 'HIGH' : 'NORMAL',
            title: 'Livraisons à réparer',
            description: `${openDeadLetters} livraison(s) attendent une décision.`,
            metadata: { openDeadLetters }
          }
        : null,
      failedAttempts >= 50
        ? {
            code: 'FAILED_ATTEMPTS_ELEVATED',
            severity: failedAttempts >= 500 ? 'CRITICAL' : 'HIGH',
            title: 'Échecs de livraison élevés',
            description: `${failedAttempts} tentative(s) sont en échec.`,
            metadata: { failedAttempts }
          }
        : null
    ];
    const activeCandidates = candidates.filter(
      (candidate): candidate is OperationalAlertCandidate => candidate !== null
    );

    const activeFingerprints: string[] = [];
    for (const candidate of activeCandidates) {
      const fingerprint = createHash('sha256')
        .update(candidate.code)
        .digest('hex');
      activeFingerprints.push(fingerprint);
      await this.prisma.profileCircleNotificationOperationalAlert.upsert({
        where: { fingerprint },
        create: {
          ...candidate,
          fingerprint,
          active: true,
          openedAt: now,
          lastSeenAt: now
        },
        update: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          metadata: candidate.metadata,
          active: true,
          occurrences: { increment: 1 },
          lastSeenAt: now,
          resolvedAt: null
        }
      });
    }

    await this.prisma.profileCircleNotificationOperationalAlert.updateMany({
      where: {
        active: true,
        ...(activeFingerprints.length
          ? { fingerprint: { notIn: activeFingerprints } }
          : {})
      },
      data: { active: false, resolvedAt: now }
    });

    return {
      openCircuits,
      openDeadLetters,
      failedAttempts,
      active: activeCandidates.length
    };
  }

  list() {
    return this.prisma.profileCircleNotificationOperationalAlert.findMany({
      orderBy: [
        { active: 'desc' },
        { severity: 'desc' },
        { lastSeenAt: 'desc' }
      ],
      take: 200
    });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/profile-circle-notification-resilience')
export class AdminProfileCircleNotificationResilienceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProfileCircleNotificationProviderStateService,
    private readonly scheduler: ProfileCircleNotificationResilienceSchedulerService,
    private readonly alerts: ProfileCircleNotificationOperationalAlertService
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [providerStates, deadLetters, suppressions, attempts, alerts] =
      await Promise.all([
        this.providers.list(),
        this.prisma.profileCircleNotificationDeadLetter.count({
          where: { status: { in: ['OPEN', 'REPLAYING'] } }
        }),
        this.prisma.profileCircleNotificationSuppression.count({
          where: { active: true }
        }),
        this.prisma.profileCircleNotificationTransportAttempt.groupBy({
          by: ['status'],
          _count: { _all: true }
        }),
        this.alerts.list()
      ]);
    return {
      providerStates,
      deadLetters,
      suppressions,
      attempts,
      scheduler: this.scheduler.status(),
      alerts,
      serverTime: new Date()
    };
  }

  @Post('maintenance/tick')
  tick() {
    return this.scheduler.tick();
  }

  @Post('alerts/refresh')
  refreshAlerts() {
    return this.alerts.refresh();
  }
}
