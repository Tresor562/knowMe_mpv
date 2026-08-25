import { MediaPurgeAlertWorkerService } from './media-purge-alert-worker.service';

describe('MediaPurgeAlertWorkerService', () => {
  const now = new Date('2026-08-25T22:00:00.000Z');

  function setup(readiness = 'HEALTHY', backlog: any = {}) {
    const retention = {
      getOperationalSnapshot: jest.fn().mockResolvedValue({
        readiness,
        backlog: {
          expiredQuarantined: 0,
          retryDue: 0,
          retryScheduled: 0,
          maxBackoffRetries: 0,
          nextScheduledRetryAt: null,
          ...backlog
        }
      })
    } as any;
    const alerts = { notify: jest.fn().mockResolvedValue('DELIVERED') } as any;
    const service = new MediaPurgeAlertWorkerService(retention, alerts);
    return { service, retention, alerts };
  }

  it('does not alert a clear retention state', async () => {
    const { service, alerts } = setup('HEALTHY');
    await expect(service.runOnce(now)).resolves.toBe('SKIPPED_NOT_ALERTABLE');
    expect(alerts.notify).not.toHaveBeenCalled();
  });

  it('delivers an aggregate alert for action-required backlog', async () => {
    const { service, alerts } = setup('HEALTHY', { expiredQuarantined: 2 });
    await expect(service.runOnce(now)).resolves.toBe('DELIVERED');
    expect(alerts.notify).toHaveBeenCalledWith({
      event: 'MEDIA_QUARANTINE_PURGE_READINESS',
      readiness: 'ACTION_REQUIRED',
      observedAt: '2026-08-25T22:00:00.000Z',
      backlog: {
        expiredQuarantined: 2,
        retryDue: 0,
        retryScheduled: 0,
        maxBackoffRetries: 0,
        nextScheduledRetryAt: null
      }
    });
  });

  it('deduplicates repeated alerts for the same state inside one hour', async () => {
    const { service, alerts } = setup('FAILING');
    await expect(service.runOnce(now)).resolves.toBe('DELIVERED');
    await expect(service.runOnce(new Date(now.getTime() + 30 * 60 * 1000))).resolves.toBe('SKIPPED_DEDUPLICATED');
    expect(alerts.notify).toHaveBeenCalledTimes(1);
  });

  it('sends a reminder after one hour while the blocking state persists', async () => {
    const { service, alerts } = setup('FAILING');
    await service.runOnce(now);
    await expect(service.runOnce(new Date(now.getTime() + 60 * 60 * 1000))).resolves.toBe('DELIVERED');
    expect(alerts.notify).toHaveBeenCalledTimes(2);
  });

  it('alerts immediately when the blocking readiness changes', async () => {
    const { service, retention, alerts } = setup('FAILING');
    await service.runOnce(now);
    retention.getOperationalSnapshot.mockResolvedValue({
      readiness: 'HEALTHY',
      backlog: {
        expiredQuarantined: 0,
        retryDue: 0,
        retryScheduled: 0,
        maxBackoffRetries: 1,
        nextScheduledRetryAt: null
      }
    });
    await expect(service.runOnce(new Date(now.getTime() + 5 * 60 * 1000))).resolves.toBe('DELIVERED');
    expect(alerts.notify).toHaveBeenLastCalledWith(expect.objectContaining({ readiness: 'BLOCKED_MAX_BACKOFF' }));
  });

  it('retries on the next poll when delivery fails instead of suppressing the incident', async () => {
    const { service, alerts } = setup('FAILING');
    alerts.notify.mockResolvedValueOnce('FAILED').mockResolvedValueOnce('DELIVERED');
    await expect(service.runOnce(now)).resolves.toBe('FAILED');
    await expect(service.runOnce(new Date(now.getTime() + 5 * 60 * 1000))).resolves.toBe('DELIVERED');
    expect(alerts.notify).toHaveBeenCalledTimes(2);
  });
});
