import { UnauthorizedException } from '@nestjs/common';
import { NexusIntegrationController } from './nexus-integration.controller';

describe('NexusIntegrationController', () => {
  const secret = 'nexus-shared-secret-that-is-longer-than-32-bytes';
  const nexus = {
    status: jest.fn().mockReturnValue({ enabled: true }),
    execute: jest.fn().mockResolvedValue({ outcome: 'completed' })
  };

  beforeEach(() => {
    process.env.NEXUS_KNOWME_SHARED_SECRET = secret;
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.NEXUS_KNOWME_SHARED_SECRET;
  });

  it('rejects missing and incorrect bearer secrets', () => {
    const controller = new NexusIntegrationController(nexus as never);
    expect(() => controller.status()).toThrow(UnauthorizedException);
    expect(() => controller.status('Bearer incorrect-secret')).toThrow(UnauthorizedException);
  });

  it('accepts the exact server-only bearer secret', async () => {
    const controller = new NexusIntegrationController(nexus as never);
    expect(controller.status(`Bearer ${secret}`)).toEqual({ enabled: true });
    await expect(controller.execute(`Bearer ${secret}`, { requestId: 'request-123456' })).resolves.toEqual({ outcome: 'completed' });
  });
});
