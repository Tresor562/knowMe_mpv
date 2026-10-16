import { EmailChallengeService } from './email-challenge.service';

describe('EmailChallengeService', () => {
  const user = {
    id: 'user-1',
    email: 'test@example.com',
    emailVerifiedAt: null,
    isSuspended: false,
    passwordHash: 'old-hash'
  };

  function setup(configured = true) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(user)
      },
      emailChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' })
      },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      trustedDevice: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1)
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn()
    };
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    const config = {
      get: jest.fn((key: string) => key === 'EMAIL_OTP_SECRET' && configured ? 'a'.repeat(64) : undefined)
    };
    const mail = { assertReady: jest.fn(), send: jest.fn().mockResolvedValue(undefined) };
    return { prisma, mail, service: new EmailChallengeService(prisma as never, config as never, mail as never) };
  }

  it('refuses to issue any code when the signing secret is absent', () => {
    const { service } = setup(false);
    expect(() => service.assertReady()).toThrow('indisponible');
  });

  it('does not send a recovery email to unknown addresses and returns the same accepted response', async () => {
    const { prisma, mail, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.requestRecovery('unknown@example.com')).resolves.toEqual({ accepted: true });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'EMAIL_CODE_PUBLIC_REQUEST' })
    }));
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('sends a six-digit verification code without storing it in cleartext', async () => {
    const { prisma, mail, service } = setup();
    await expect(service.resendSignup('TEST@EXAMPLE.COM')).resolves.toMatchObject({ accepted: true });
    expect(mail.send).toHaveBeenCalledWith(
      'test@example.com', expect.stringContaining('Confirmez'), expect.any(String), expect.stringMatching(/^\d{6}$/)
    );
    const created = prisma.emailChallenge.create.mock.calls[0][0].data as { codeHash: string; targetEmail: string };
    expect(created.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.codeHash).not.toEqual(mail.send.mock.calls[0][3]);
    expect(created.targetEmail).toBe('test@example.com');
  });

  it('rejects an incorrect code and never updates the confirmed email', async () => {
    const { prisma, service } = setup();
    prisma.emailChallenge.findFirst.mockResolvedValue({
      id: 'challenge-1', codeHash: 'f'.repeat(64),
      attempts: 0, expiresAt: new Date(Date.now() + 600000), consumedAt: null,
      targetEmail: user.email
    });
    await expect(service.confirmSignup(user.email, '123456')).rejects.toThrow('Code invalide');
    expect(prisma.emailChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { attempts: { increment: 1 } }
    }));
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an expired code without modifying the account', async () => {
    const { prisma, service } = setup();
    prisma.emailChallenge.findFirst.mockResolvedValue({
      id: 'challenge-1', codeHash: 'f'.repeat(64),
      attempts: 0, expiresAt: new Date(Date.now() - 1000), consumedAt: null,
      targetEmail: user.email
    });
    await expect(service.confirmSignup(user.email, '123456')).rejects.toThrow();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
