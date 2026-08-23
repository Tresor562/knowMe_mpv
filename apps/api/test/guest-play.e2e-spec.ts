import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const CONVERSION_EMAIL = 'guest-convert@knowme.test';

describe('Guest identity baseline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.guestIdentity.deleteMany();
    await prisma.user.deleteMany({ where: { email: CONVERSION_EMAIL } });
  });

  afterAll(async () => {
    await prisma.guestIdentity.deleteMany();
    await prisma.user.deleteMany({ where: { email: CONVERSION_EMAIL } });
    await app.close();
  });

  it('publishes a privacy-minimized guest policy with bounded gameplay but no account transfer claim', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/policy')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      storesRealIdentity: false,
      storesContacts: false,
      requiresAccount: false,
      supportsGameplay: true,
      conversionEnabled: true,
      conversionTransfersGameplayData: false
    }));
  });

  it('creates, resumes and revokes an expiring opaque guest credential', async () => {
    const creation = await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        publicAlias: 'Guest Player',
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(201);

    const token = creation.body.token as string;
    expect(token).toMatch(/^kg_[A-Za-z0-9_-]{43}$/);
    expect(creation.body.guest).toEqual(expect.objectContaining({
      publicAlias: 'Guest Player',
      locale: 'fr-BJ',
      consentVersion: '2026-08-22',
      ageGateState: 'ADULT',
      status: 'ACTIVE'
    }));
    expect(creation.body.guest).not.toHaveProperty('tokenHash');

    const stored = await prisma.guestIdentity.findUniqueOrThrow({
      where: { id: creation.body.guest.id as string }
    });
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(token);

    const resumed = await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(resumed.body.id).toBe(creation.body.guest.id);
    expect(resumed.body).not.toHaveProperty('tokenHash');

    await request(app.getHttpServer())
      .delete('/guest/session')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ revoked: true });

    await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('plays Quick Math end-to-end with server state, idempotent actions and guest isolation', async () => {
    const creation = await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        publicAlias: 'Math Guest',
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(201);
    const token = creation.body.token as string;
    const guestId = creation.body.guest.id as string;

    const created = await request(app.getHttpServer())
      .post('/guest/games/quick-math/sessions')
      .set('authorization', `Bearer ${token}`)
      .send({ idempotencyKey: 'guest:create:math:0001' })
      .expect(201);

    expect(created.body).toEqual(expect.objectContaining({
      status: 'ACTIVE',
      sequence: 0,
      replayed: false,
      serverAuthoritative: true,
      economicStake: null,
      accountRequired: false,
      game: expect.objectContaining({ key: 'quick-math', version: 1 }),
      state: expect.objectContaining({ phase: 'READY', round: 0, score: 0 })
    }));
    expect(created.body).not.toHaveProperty('seed');
    expect(JSON.stringify(created.body)).not.toContain('tokenHash');

    const sessionId = created.body.id as string;
    const storedSession = await prisma.guestGameSession.findUniqueOrThrow({
      where: { id: sessionId }
    });
    expect(storedSession.guestId).toBe(guestId);
    expect(storedSession.seed).toMatch(/^[a-f0-9]{64}$/);
    expect(storedSession.expiresAt.getTime()).toBeLessThanOrEqual(
      new Date(creation.body.guest.expiresAt as string).getTime()
    );

    const started = await request(app.getHttpServer())
      .post(`/guest/games/sessions/${sessionId}/actions`)
      .set('authorization', `Bearer ${token}`)
      .send({
        actionType: 'START',
        payload: {},
        expectedSequence: 0,
        idempotencyKey: 'guest:start:math:0001'
      })
      .expect(201);
    expect(started.body.sequence).toBe(1);
    expect(started.body.state).toEqual(expect.objectContaining({ phase: 'ACTIVE', round: 1 }));
    expect(started.body.state.question).toEqual(expect.objectContaining({
      left: expect.any(Number),
      right: expect.any(Number),
      operator: expect.stringMatching(/^[+-]$/)
    }));

    const replayedStart = await request(app.getHttpServer())
      .post(`/guest/games/sessions/${sessionId}/actions`)
      .set('authorization', `Bearer ${token}`)
      .send({
        actionType: 'START',
        payload: {},
        expectedSequence: 0,
        idempotencyKey: 'guest:start:math:0001'
      })
      .expect(201);
    expect(replayedStart.body.replayed).toBe(true);
    expect(replayedStart.body.sequence).toBe(1);

    let current = started.body;
    for (let round = 1; round <= 5; round += 1) {
      const question = current.state.question as {
        left: number;
        right: number;
        operator: '+' | '-';
      };
      const answer = question.operator === '+'
        ? question.left + question.right
        : question.left - question.right;
      const response = await request(app.getHttpServer())
        .post(`/guest/games/sessions/${sessionId}/actions`)
        .set('authorization', `Bearer ${token}`)
        .send({
          actionType: 'ANSWER',
          payload: { answer },
          expectedSequence: current.sequence as number,
          idempotencyKey: `guest:answer:${round}:0001`
        })
        .expect(201);
      current = response.body;
    }

    expect(current).toEqual(expect.objectContaining({
      status: 'COMPLETED',
      sequence: 6,
      currentTurnPosition: null,
      result: {
        outcome: 'COMPLETED',
        score: 5,
        correctAnswers: 5,
        rounds: 5
      },
      state: expect.objectContaining({
        phase: 'COMPLETED',
        score: 5,
        completed: true,
        question: null
      })
    }));

    const persistedActions = await prisma.guestGameAction.count({
      where: { sessionId, guestId }
    });
    expect(persistedActions).toBe(6);

    const stranger = await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/guest/games/sessions/${sessionId}`)
      .set('authorization', `Bearer ${stranger.body.token as string}`)
      .expect(404);

    await request(app.getHttpServer())
      .post('/guest/games/pulse-duel/sessions')
      .set('authorization', `Bearer ${token}`)
      .send({ idempotencyKey: 'guest:create:pulse:0001' })
      .expect(404);
  });

  it('converts one active guest to one authenticated account and invalidates the guest credential', async () => {
    const creation = await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        publicAlias: 'Convert Me',
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(201);
    const guestToken = creation.body.token as string;
    const guestId = creation.body.guest.id as string;

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: CONVERSION_EMAIL,
        username: 'guest_convert',
        displayName: 'Converted Guest',
        password: 'KnowMeTest123!'
      })
      .expect(201);
    const accessToken = registered.body.accessToken as string;
    const userId = registered.body.user.id as string;

    const converted = await request(app.getHttpServer())
      .post('/guest/convert')
      .set('authorization', `Bearer ${accessToken}`)
      .set('x-knowme-guest-token', guestToken)
      .expect(201);

    expect(converted.body).toEqual({
      converted: true,
      transferred: { gameplayData: false, scores: 0, achievements: 0, preferences: 0 }
    });

    const stored = await prisma.guestIdentity.findUniqueOrThrow({ where: { id: guestId } });
    expect(stored.status).toBe('CONVERTED');
    expect(stored.convertedUserId).toBe(userId);
    expect(stored.convertedAt).toBeInstanceOf(Date);

    await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', `Bearer ${guestToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/guest/convert')
      .set('authorization', `Bearer ${accessToken}`)
      .set('x-knowme-guest-token', guestToken)
      .expect(401);
  });

  it('requires account authentication and a valid guest credential for conversion', async () => {
    const guestToken = `kg_${'Z'.repeat(43)}`;

    await request(app.getHttpServer())
      .post('/guest/convert')
      .set('x-knowme-guest-token', guestToken)
      .expect(401);

    const registered = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: CONVERSION_EMAIL, password: 'KnowMeTest123!' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/guest/convert')
      .set('authorization', `Bearer ${registered.body.accessToken as string}`)
      .set('x-knowme-guest-token', 'kg_short')
      .expect(401);
  });

  it('fails closed for malformed guest credentials and invalid profile input', async () => {
    await request(app.getHttpServer())
      .get('/guest/session')
      .set('authorization', 'Bearer arbitrary-token')
      .expect(401);

    await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        publicAlias: '<script>alert(1)</script>',
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'ADULT'
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/guest/sessions')
      .send({
        locale: 'fr-BJ',
        consentVersion: '2026-08-22',
        ageGateState: 'NOT_A_REAL_GATE'
      })
      .expect(400);
  });
});
