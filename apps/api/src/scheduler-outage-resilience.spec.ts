import { Logger } from '@nestjs/common';
import { CreatorMetricsRetentionService } from './creators/creator-metrics-retention.service';
import { GameSessionMaintenanceService } from './games/game-session-maintenance.service';
import { ProfileCircleNotificationResilienceSchedulerService } from './profile-experience/profile-circle-notification-resilience-scheduler.service';
import { ProfileCircleNotificationSchedulerService } from './profile-experience/profile-circle-notification-scheduler.service';
import { SocialMatchmakingMaintenanceService } from './social-matchmaking/social-matchmaking-maintenance.service';

type ScheduledTickBoundary = { runScheduledTick: () => Promise<void> };
type ScheduledCleanupBoundary = { runScheduledCleanup: () => Promise<void> };

describe('scheduler outage resilience', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('contains game maintenance dependency failures and permits a later tick', async () => {
    const games = {
      expireDue: jest
        .fn()
        .mockRejectedValueOnce(new Error('db unavailable'))
        .mockResolvedValueOnce({ inspected: 1, expired: 0 })
    };
    const tournaments = {
      syncDue: jest.fn().mockResolvedValue({
        inspectedTournamentMatches: 0,
        advancedTournamentMatches: 0,
        tournamentMatchesRequiringReview: 0
      })
    };
    const service = new GameSessionMaintenanceService(games as never, tournaments as never);

    await expect((service as unknown as ScheduledTickBoundary).runScheduledTick()).resolves.toBeUndefined();
    await expect(service.tick(1)).resolves.toEqual(expect.objectContaining({ skipped: false, inspected: 1 }));
  });

  it('contains social matchmaking dependency failures and permits a later tick', async () => {
    const matchmaking = {
      expireDue: jest
        .fn()
        .mockRejectedValueOnce(new Error('db unavailable'))
        .mockResolvedValueOnce({ expiredEntries: 0, expiredProposals: 0 }),
      matchQueued: jest.fn().mockResolvedValue({ inspected: 1, matched: 0 })
    };
    const connections = {
      expireDue: jest.fn().mockResolvedValue({ expiredConnectionIntents: 0 })
    };
    const service = new SocialMatchmakingMaintenanceService(
      matchmaking as never,
      connections as never
    );

    await expect((service as unknown as ScheduledTickBoundary).runScheduledTick()).resolves.toBeUndefined();
    await expect(service.tick(1)).resolves.toEqual(expect.objectContaining({ skipped: false, inspected: 1 }));
  });

  it('contains creator retention dependency failures and permits a later cleanup', async () => {
    const prisma = {
      creatorAudienceReceipt: {
        findMany: jest
          .fn()
          .mockRejectedValueOnce(new Error('db unavailable'))
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn()
      }
    };
    const service = new CreatorMetricsRetentionService(prisma as never);

    await expect(
      (service as unknown as ScheduledCleanupBoundary).runScheduledCleanup()
    ).resolves.toBeUndefined();
    await expect(service.cleanup(1)).resolves.toEqual({ skipped: false, deleted: 0 });
  });

  it('contains notification scheduler lease failures before the tick try block', async () => {
    const config = {
      enabled: true,
      nodeId: 'node-ci',
      leaseTtlMs: 60_000,
      schedulerIntervalMs: 60_000,
      schedulerBatchSize: 10
    };
    const leases = {
      acquire: jest
        .fn()
        .mockRejectedValueOnce(new Error('db unavailable'))
        .mockResolvedValueOnce({ leaseToken: 'lease-1' }),
      release: jest.fn().mockResolvedValue(undefined)
    };
    const delivery = {
      retryFailed: jest.fn().mockResolvedValue({}),
      flushDue: jest.fn().mockResolvedValue({ delivered: 0 })
    };
    const weekly = { flushDue: jest.fn().mockResolvedValue({}) };
    const telemetry = {
      schedulerSucceeded: jest.fn(),
      schedulerFailed: jest.fn(),
      observe: jest.fn()
    };
    const runtimeConfig = { get: jest.fn().mockReturnValue(config) };
    const service = new ProfileCircleNotificationSchedulerService(
      delivery as never,
      leases as never,
      weekly as never,
      telemetry as never,
      runtimeConfig as never
    );

    await expect((service as unknown as ScheduledTickBoundary).runScheduledTick()).resolves.toBeUndefined();
    await expect(service.tick()).resolves.toEqual(expect.objectContaining({ skipped: false }));
  });

  it('contains notification resilience lease failures before the tick try block', async () => {
    const config = {
      enabled: true,
      resilienceEnabled: true,
      nodeId: 'node-ci',
      leaseTtlMs: 60_000,
      schedulerIntervalMs: 60_000,
      schedulerBatchSize: 10
    };
    const leases = {
      acquire: jest
        .fn()
        .mockRejectedValueOnce(new Error('db unavailable'))
        .mockResolvedValueOnce({ leaseToken: 'lease-1' }),
      release: jest.fn().mockResolvedValue(undefined)
    };
    const retries = { planFailed: jest.fn().mockResolvedValue({ planned: 0 }) };
    const rateLimits = { cleanup: jest.fn().mockResolvedValue(0) };
    const suppressions = { expire: jest.fn().mockResolvedValue(0) };
    const runtimeConfig = { get: jest.fn().mockReturnValue(config) };
    const service = new ProfileCircleNotificationResilienceSchedulerService(
      runtimeConfig as never,
      leases as never,
      retries as never,
      rateLimits as never,
      suppressions as never
    );

    await expect((service as unknown as ScheduledTickBoundary).runScheduledTick()).resolves.toBeUndefined();
    await expect(service.tick()).resolves.toEqual(expect.objectContaining({ skipped: false }));
  });
});
