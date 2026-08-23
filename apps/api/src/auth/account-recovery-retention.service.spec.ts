import { AccountRecoveryRetentionService } from './account-recovery-retention.service';

describe('AccountRecoveryRetentionService', () => {
  function setup(values: Record<string, string | undefined> = {}) {
    const config = {
      get: jest.fn((key: string) => values[key])
    };
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    return {
      prisma,
      service: new AccountRecoveryRetentionService(prisma as never, config as never)
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not delete anything when no retention duration has been explicitly configured', async () => {
    const { prisma, service } = setup();

    await expect(service.purgeExpiredBatch(new Date('2026-08-23T00:00:00.000Z'))).resolves.toEqual({
      configured: false,
      deleted: 0,
      cutoff: null
    });
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes only bounded account-recovery attempt candidates older than the configured cutoff', async () => {
    const { prisma, service } = setup({
      ACCOUNT_RECOVERY_ATTEMPT_RETENTION_DAYS: '30',
      ACCOUNT_RECOVERY_RETENTION_BATCH_SIZE: '2'
    });
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit-1' }, { id: 'audit-2' }]);
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 2 });
    const now = new Date('2026-08-23T00:00:00.000Z');
    const expectedCutoff = new Date('2026-07-24T00:00:00.000Z');

    await expect(service.purgeExpiredBatch(now)).resolves.toEqual({
      configured: true,
      deleted: 2,
      cutoff: expectedCutoff
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'ACCOUNT_RECOVERY_ATTEMPT',
        entity: 'ACCOUNT_RECOVERY',
        createdAt: { lt: expectedCutoff }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
      take: 2
    });
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['audit-1', 'audit-2'] },
        action: 'ACCOUNT_RECOVERY_ATTEMPT',
        entity: 'ACCOUNT_RECOVERY',
        createdAt: { lt: expectedCutoff }
      }
    });
    expect(service.getMaintenanceSnapshot()).toEqual({
      configured: true,
      enabled: true,
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastFailureAt: null,
      lastDeleted: 2
    });
  });

  it('never broadens deletion to unrelated audit actions', async () => {
    const { prisma, service } = setup({ ACCOUNT_RECOVERY_ATTEMPT_RETENTION_DAYS: '7' });
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'attempt-only' }]);
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 1 });

    await service.purgeExpiredBatch(new Date('2026-08-23T00:00:00.000Z'));

    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        action: 'ACCOUNT_RECOVERY_ATTEMPT',
        entity: 'ACCOUNT_RECOVERY'
      })
    }));
  });

  it('does not schedule maintenance when the duration is missing or maintenance is disabled', () => {
    jest.useFakeTimers();
    const intervalSpy = jest.spyOn(global, 'setInterval');

    const missing = setup();
    missing.service.onModuleInit();
    expect(intervalSpy).not.toHaveBeenCalled();

    const disabled = setup({
      ACCOUNT_RECOVERY_ATTEMPT_RETENTION_DAYS: '30',
      ACCOUNT_RECOVERY_RETENTION_MAINTENANCE_ENABLED: 'false'
    });
    disabled.service.onModuleInit();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(disabled.service.getMaintenanceSnapshot()).toEqual({
      configured: true,
      enabled: false,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastDeleted: 0
    });
  });
});
