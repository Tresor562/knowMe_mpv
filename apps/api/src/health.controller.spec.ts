import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the service status', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('knowme-api');
    expect(result.timestamp).toBeDefined();
  });
});
