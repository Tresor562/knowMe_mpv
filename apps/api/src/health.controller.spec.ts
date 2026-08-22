import { ServiceUnavailableException } from '@nestjs/common';
import { recordRuntimeHttpMetric, resetRuntimeHttpMetricsForTests } from './common/http-observability';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';

describe('HealthController', () => {
  beforeEach(() => resetRuntimeHttpMetricsForTests());

  const makeController = () => {
    const prisma = {
      $queryRaw: jest.fn()
    } as unknown as PrismaService;

    return {
      controller: new HealthController(prisma),
      queryRaw: prisma.$queryRaw as unknown as jest.Mock
    };
  };

  it('keeps the legacy health endpoint dependency-free', () => {
    const { controller, queryRaw } = makeController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('knowme-api');
    expect(result.timestamp).toBeDefined();
    expect(result.checks).toEqual({ process: 'up' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports liveness without touching PostgreSQL', () => {
    const { controller, queryRaw } = makeController();
    const result = controller.getLiveness();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ process: 'up' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('exposes only aggregate runtime metrics without touching PostgreSQL', () => {
    const { controller, queryRaw } = makeController();
    recordRuntimeHttpMetric(200, 50);
    recordRuntimeHttpMetric(503, 900);

    const result = controller.getMetrics();

    expect(result.service).toBe('knowme-api');
    expect(result.uptimeSeconds).toEqual(expect.any(Number));
    expect(result.http.requests).toEqual({
      total: 2,
      success2xx: 1,
      clientError4xx: 0,
      serverError5xx: 1,
      other: 0
    });
    expect(JSON.stringify(result)).not.toContain('requestId');
    expect(JSON.stringify(result)).not.toContain('path');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports ready only when PostgreSQL answers', async () => {
    const { controller, queryRaw } = makeController();
    queryRaw.mockResolvedValue([{ value: 1 }]);

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      service: 'knowme-api',
      checks: { database: 'up' }
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('fails readiness closed without leaking database errors', async () => {
    const { controller, queryRaw } = makeController();
    queryRaw.mockRejectedValue(new Error('postgresql://user:secret@db.internal/knowme'));

    let thrown: unknown;
    try {
      await controller.getReadiness();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    const response = (thrown as ServiceUnavailableException).getResponse();
    expect(response).toMatchObject({
      status: 'not_ready',
      service: 'knowme-api',
      checks: { database: 'down' }
    });
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(JSON.stringify(response)).not.toContain('db.internal');
  });
});
