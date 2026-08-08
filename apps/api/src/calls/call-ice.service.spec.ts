import { ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { CallIceService } from './call-ice.service';

describe('CallIceService', () => {
  const now = Date.parse('2026-08-04T10:00:00.000Z');

  function setup(overrides: Record<string, string> = {}) {
    const values: Record<string, string> = {
      NODE_ENV: 'production',
      CALL_REQUIRE_TURN_IN_PRODUCTION: 'true',
      CALL_STUN_URLS_JSON: '["stun:stun.knowme.test:3478"]',
      CALL_TURN_URLS_JSON:
        '["turns:turn.knowme.test:5349?transport=tcp","turn:turn.knowme.test:3478?transport=udp"]',
      CALL_TURN_SECRET: 'turn-secret-known-only-by-the-server',
      CALL_TURN_TTL_SECONDS: '600',
      ...overrides
    };
    const config = {
      get: jest.fn((name: string) => values[name])
    };
    const calls = {
      view: jest.fn().mockResolvedValue({ id: 'call-1', status: 'RINGING' })
    };
    const prisma = {
      callEvent: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'event-1' })
      }
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new CallIceService(
      config as never,
      calls as never,
      prisma as never,
      audit as never
    );
    return { service, config, calls, prisma, audit, values };
  }

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues deterministic short-lived credentials without exposing the secret', async () => {
    const { service, prisma, audit, values } = setup();

    const result = await service.issue('alice', 'call-1');

    const expiresUnix = Math.floor(now / 1_000) + 600;
    const username = `${expiresUnix}:alice:call-1`;
    const expectedCredential = createHmac(
      'sha1',
      values.CALL_TURN_SECRET
    )
      .update(username)
      .digest('base64');

    expect(result.iceServers).toEqual([
      { urls: ['stun:stun.knowme.test:3478'] },
      {
        urls: [
          'turns:turn.knowme.test:5349?transport=tcp',
          'turn:turn.knowme.test:3478?transport=udp'
        ],
        username,
        credential: expectedCredential,
        credentialType: 'password'
      }
    ]);
    expect(result.policy).toEqual(
      expect.objectContaining({
        ephemeralCredentials: true,
        ttlSeconds: 600,
        secretExposed: false,
        persistedCredential: false,
        productionTurnRequired: true
      })
    );
    expect(JSON.stringify(result)).not.toContain(values.CALL_TURN_SECRET);
    expect(prisma.callEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call-1',
        actorId: 'alice',
        action: 'ICE_CONFIGURATION_ISSUED',
        metadata: expect.objectContaining({
          turnConfigured: true,
          credentialFingerprint: expect.any(String)
        })
      })
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CALL_ICE_CONFIGURATION_ISSUED',
        entityId: 'call-1'
      })
    );
  });

  it('fails closed in production when TURN is missing', async () => {
    const { service } = setup({
      CALL_TURN_URLS_JSON: '[]',
      CALL_TURN_SECRET: ''
    });

    await expect(service.issue('alice', 'call-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('refuses credentials after the call becomes terminal', async () => {
    const { service, calls } = setup();
    calls.view.mockResolvedValueOnce({ id: 'call-1', status: 'ENDED' });

    await expect(service.issue('alice', 'call-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CALL_ICE_NOT_AVAILABLE' })
    });
  });

  it('rate limits repeated credential issuance per participant and call', async () => {
    const { service, prisma } = setup();
    prisma.callEvent.count.mockResolvedValueOnce(12);

    await expect(service.issue('alice', 'call-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CALL_ICE_RATE_LIMITED' })
    });
  });
});
