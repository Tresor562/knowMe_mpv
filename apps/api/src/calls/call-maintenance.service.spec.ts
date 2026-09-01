import { CallMaintenanceService } from './call-maintenance.service';

describe('CallMaintenanceService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('contains a scheduled dependency failure and remains usable for the next tick', async () => {
    const calls = {
      expireDue: jest
        .fn()
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValueOnce({ inspectedCalls: 1, missedCalls: 0 })
    };
    const service = new CallMaintenanceService(calls as never);

    await expect(
      (service as unknown as { runScheduledTick: () => Promise<void> }).runScheduledTick()
    ).resolves.toBeUndefined();

    await expect(service.tick(1)).resolves.toEqual({
      skipped: false,
      inspectedCalls: 1,
      missedCalls: 0
    });
    expect(calls.expireDue).toHaveBeenCalledTimes(2);
  });

  it('keeps direct tick failures observable to explicit callers', async () => {
    const calls = {
      expireDue: jest.fn().mockRejectedValue(new Error('database unavailable'))
    };
    const service = new CallMaintenanceService(calls as never);

    await expect(service.tick(1)).rejects.toThrow('database unavailable');
  });
});
