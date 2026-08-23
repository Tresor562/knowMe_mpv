import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AccountRecoveryService } from './account-recovery.service';

describe('AccountRecoveryService', () => {
  const user = {
    id: 'user-1',
    email: 'alice@example.com',
    isSuspended: false,
    passwordHash: 'argon2-old-hash'
  };

  function setup(overrides: Record<string, string | undefined> = {}) {
    const configValues: Record<string, string | undefined> = {
      ACCOUNT_RECOVERY_SECRET: 'r'.repeat(48),
      ACCOUNT_RECOVERY_EMAIL_ENDPOINT: 'https://mail.example.test/send',
      ACCOUNT_RECOVERY_EMAIL_API_KEY: 'test-api-key',
      ACCOUNT_RECOVERY_EMAIL_FROM: 'KnowMe <security@example.test>',
      WEB_URL: 'https://knowme.example.test',
      ...overrides
    };
    const prisma = {
      user: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      trustedDevice: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({})
      },
      $transaction: jest.fn()
    };
    prisma.$transaction.mockImplementation(async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma));

    const config = {
      get: jest.fn((key: string) => configValues[key])
    };
    return {
      prisma,
      service: new AccountRecoveryService(prisma as never, config as never)
    };
  }

  async function issueToken(service: AccountRecoveryService, prisma: ReturnType<typeof setup>['prisma']) {
    prisma.user.findUnique.mockResolvedValue(user);
    let resetToken = '';
    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { html: string };
      const match = body.html.match(/token=([^"&<]+)/);
      resetToken = decodeURIComponent(match?.[1] ?? '');
      return new Response('', { status: 202 });
    });
    await service.request(user.email);
    return resetToken;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the same accepted response for an unknown account without contacting the provider', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(service.request('nobody@example.com')).resolves.toEqual({ accepted: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails account-independently when recovery infrastructure is not configured', async () => {
    const { prisma, service } = setup({ ACCOUNT_RECOVERY_SECRET: undefined });

    await expect(service.request('nobody@example.com')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not reveal a provider delivery failure for an existing account', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(user);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    await expect(service.request(user.email)).resolves.toEqual({ accepted: true });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'ACCOUNT_RECOVERY_DELIVERY_FAILED' })
    }));
  });

  it('resets a password once and revokes sessions plus trusted devices', async () => {
    const { prisma, service } = setup();
    const resetToken = await issueToken(service, prisma);
    expect(resetToken.length).toBeGreaterThan(32);

    prisma.user.findUnique.mockResolvedValue(user);
    await expect(service.reset(resetToken, 'a-new-password-123')).resolves.toEqual({ reset: true });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: user.id, passwordHash: user.passwordHash })
    }));
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: user.id, revokedAt: null })
    }));
    expect(prisma.trustedDevice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: user.id, revokedAt: null })
    }));
  });

  it('fails closed if another reset consumed the password state first', async () => {
    const { prisma, service } = setup();
    const resetToken = await issueToken(service, prisma);

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reset(resetToken, 'a-new-password-123')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.trustedDevice.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an otherwise valid token with an extra segment', async () => {
    const { prisma, service } = setup();
    const resetToken = await issueToken(service, prisma);

    await expect(service.reset(`${resetToken}.unexpected`, 'a-new-password-123'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a tampered reset token', async () => {
    const { service } = setup();
    await expect(service.reset('tampered.token-value', 'a-new-password-123')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
