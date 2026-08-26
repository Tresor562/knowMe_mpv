import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { recordRuntimeHttpMetric, resetRuntimeHttpMetricsForTests } from './common/http-observability';
import { hasMetricsAccess, HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';

describe('HealthController', () => {
  const originalMetricsToken = process.env.METRICS_BEARER_TOKEN;
  const originalReleaseCommit = process.env.KNOWME_RELEASE_COMMIT;
  const originalReleaseVersion = process.env.KNOWME_RELEASE_VERSION;

  beforeEach(() => {
    resetRuntimeHttpMetricsForTests();
    process.env.METRICS_BEARER_TOKEN = 'm'.repeat(64);
    delete process.env.KNOWME_RELEASE_COMMIT;
    delete process.env.KNOWME_RELEASE_VERSION;
  });

  afterAll(() => {
    if (originalMetricsToken === undefined) delete process.env.METRICS_BEARER_TOKEN;
    else process.env.METRICS_BEARER_TOKEN = originalMetricsToken;
    if (originalReleaseCommit === undefined) delete process.env.KNOWME_RELEASE_COMMIT;
    else process.env.KNOWME_RELEASE_COMMIT = originalReleaseCommit;
    if (originalReleaseVersion === undefined) delete process.env.KNOWME_RELEASE_VERSION;
    else process.env.KNOWME_RELEASE_VERSION = originalReleaseVersion;
  });

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
    expect(result.release).toEqual({ commit: null, version: null });
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

  it('exposes the exact configured runtime release identity without extra metadata', () => {
    process.env.KNOWME_RELEASE_COMMIT = 'a'.repeat(40);
    process.env.KNOWME_RELEASE_VERSION = '1.0.0-rc.1';
    const { controller } = makeController();

    expect(controller.getLiveness().release).toEqual({
      commit: 'a'.repeat(40),
      version: '1.0.0-rc.1'
    });
  });

  it('accepts only the exact configured bearer token', () => {
    const token = 'x'.repeat(64);

    expect(hasMetricsAccess(`Bearer ${token}`, token)).toBe(true);
    expect(hasMetricsAccess(`Bearer ${'y'.repeat(64)}`, token)).toBe(false);
    expect(hasMetricsAccess(token, token)).toBe(false);
    expect(hasMetricsAccess(undefined, token)).toBe(false);
    expect(hasMetricsAccess(`Bearer ${token}`, 'short')).toBe(false);
  });

  it('exposes only aggregate runtime metrics to an authorized collector without touching PostgreSQL', () => {
    const { controller, queryRaw } = makeController();
    recordRuntimeHttpMetric(200, 50);
    recordRuntimeHttpMetric(503, 900);

    const result = controller.getMetrics(`Bearer ${process.env.METRICS_BEARER_TOKEN}`);

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
    expect(JSON.stringify(result)).not.toContain(process.env.METRICS_BEARER_TOKEN);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid metrics credentials without returning metric data', () => {
    const { controller } = makeController();
    recordRuntimeHttpMetric(500, 1200);

    expect(() => controller.getMetrics()).toThrow(UnauthorizedException);
    expect(() => controller.getMetrics('Bearer wrong-token')).toThrow(UnauthorizedException);
  });

  it('fails the metrics endpoint closed when its server secret is missing or weak', () => {
    const { controller } = makeController();

    delete process.env.METRICS_BEARER_TOKEN;
    expect(() => controller.getMetrics('Bearer anything')).toThrow(ServiceUnavailableException);

    process.env.METRICS_BEARER_TOKEN = 'short';
    expect(() => controller.getMetrics('Bearer short')).toThrow(ServiceUnavailableException);
  });

  it('reports ready only when PostgreSQL answers', async () => {
    const { controller, queryRaw } = makeController();
    queryRaw.mockResolvedValue([{ value: 1 }]);

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      service: 'knowme-api',
      release: { commit: null, version: null },
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
      release: { commit: null, version: null },
      checks: { database: 'down' }
    });
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(JSON.stringify(response)).not.toContain('db.internal');
  });
});
