import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative game platform (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accounts: AccountService;

  beforeAll(async () => {
    process.env.GAME_PLATFORM_MAINTENANCE_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    accounts = app.get(AccountService);

    await prisma.gameActionReceipt.deleteMany();
    await prisma.gameAction.deleteMany();
    await prisma.gameReplaySnapshot.deleteMany();
    await prisma.gameGovernanceEvent.deleteMany();
    await prisma.gameParticipant.deleteMany();
    await prisma.gameSession.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.GAME_PLATFORM_MAINTENANCE_ENABLED;
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  it('runs a deterministic server-authoritative game and preserves lifecycle guarantees', async () => {
    const owner = await register('game-owner@knowme.test', 'game_owner', 'Game Owner');
    const opponent = await register(
      'game-opponent@knowme.test',
      'game_opponent',
      'Game Opponent'
    );
    const intruder = await register(
      'game-intruder@knowme.test',
      'game_intruder',
      'Game Intruder'
    );
    const victim = await register(
      'game-victim@knowme.test',
      'game_victim',
      'Game Victim'
    );

    const ownerId = owner.body.user.id as string;
    const opponentId = opponent.body.user.id as string;
    const victimId = victim.body.user.id as string;
    const ownerAuth = { Authorization: `Bearer ${owner.body.accessToken}` };
    const opponentAuth = { Authorization: `Bearer ${opponent.body.accessToken}` };
    const intruderAuth = { Authorization: `Bearer ${intruder.body.accessToken}` };
    const victimAuth = { Authorization: `Bearer ${victim.body.accessToken}` };

    const legacyExport = await accounts.exportData(ownerId);
    expect(legacyExport.formatVersion).toBe(6);
    expect(legacyExport.gamePlatform).toBeUndefined();

    const catalog = await request(app.getHttpServer())
      .get('/games/catalog')
      .expect(200);
    expect(catalog.body).toContainEqual(
      expect.objectContaining({
        key: 'pulse-duel',
        version: 1,
        authoritativeServer: true,
        economicStakeAllowed: false,
        replayAvailable: true
      })
    );

    const creationPayload = {
      gameKey: 'pulse-duel',
      opponentUsernames: ['game_opponent'],
      idempotencyKey: 'game:create:primary'
    };
    const created = await request(app.getHttpServer())
      .post('/games/sessions')
      .set(ownerAuth)
      .send(creationPayload)
      .expect(201);
    const sessionId = created.body.id as string;
    expect(created.body).toEqual(
      expect.objectContaining({
        id: sessionId,
        status: 'WAITING',
        sequence: 0,
        replayed: false,
        serverAuthoritative: true,
        economicStake: null
      })
    );
    expect(JSON.stringify(created.body)).not.toContain('seed');

    const replayedCreation = await request(app.getHttpServer())
      .post('/games/sessions')
      .set(ownerAuth)
      .send(creationPayload)
      .expect(201);
    expect(replayedCreation.body).toEqual(
      expect.objectContaining({ id: sessionId, replayed: true })
    );
    expect(await prisma.gameSession.count()).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: opponentId, type: 'GAME_INVITATION' }
      })
    ).toBe(1);

    await request(app.getHttpServer())
      .get(`/games/sessions/${sessionId}`)
      .set(intruderAuth)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/games/sessions/${sessionId}/replay`)
      .set(ownerAuth)
      .expect(409);

    const joined = await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/join`)
      .set(opponentAuth)
      .expect(201);
    expect(joined.body).toEqual(
      expect.objectContaining({ status: 'ACTIVE', sequence: 0, replayed: false })
    );

    await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/actions`)
      .set(opponentAuth)
      .send({
        actionType: 'PULSE',
        payload: { value: 9 },
        expectedSequence: 99,
        idempotencyKey: 'game:stale:opponent'
      })
      .expect(409);

    const firstActionPayload = {
      actionType: 'PULSE',
      payload: { value: 4 },
      expectedSequence: 0,
      idempotencyKey: 'game:action:0001'
    };
    let current = await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/actions`)
      .set(ownerAuth)
      .send(firstActionPayload)
      .expect(201);
    expect(current.body).toEqual(
      expect.objectContaining({
        status: 'ACTIVE',
        sequence: 1,
        currentTurnPosition: 1,
        replayed: false
      })
    );
    expect(current.body.state).toEqual(
      expect.objectContaining({ pendingPosition: 0 })
    );
    expect(JSON.stringify(current.body.state)).not.toContain('"value":4');

    const duplicateAction = await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/actions`)
      .set(ownerAuth)
      .send(firstActionPayload)
      .expect(201);
    expect(duplicateAction.body).toEqual(
      expect.objectContaining({ sequence: 1, replayed: true })
    );
    expect(await prisma.gameAction.count({ where: { sessionId } })).toBe(1);

    await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/actions`)
      .set(ownerAuth)
      .send({
        actionType: 'PULSE',
        payload: { value: 5 },
        expectedSequence: 1,
        idempotencyKey: 'game:action:not-your-turn'
      })
      .expect(409);

    let safety = 0;
    while (current.body.status === 'ACTIVE') {
      safety += 1;
      expect(safety).toBeLessThanOrEqual(9);
      const turn = current.body.currentTurnPosition as number;
      const expectedSequence = current.body.sequence as number;
      const auth = turn === 0 ? ownerAuth : opponentAuth;
      current = await request(app.getHttpServer())
        .post(`/games/sessions/${sessionId}/actions`)
        .set(auth)
        .send({
          actionType: 'PULSE',
          payload: { value: ((expectedSequence * 3) % 9) + 1 },
          expectedSequence,
          idempotencyKey: `game:action:${String(expectedSequence + 1).padStart(4, '0')}`
        })
        .expect(201);
    }

    expect(current.body).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        sequence: 10,
        currentTurnPosition: null,
        result: expect.objectContaining({ rounds: 5 })
      })
    );
    expect(await prisma.gameAction.count({ where: { sessionId } })).toBe(10);
    expect(await prisma.gameActionReceipt.count({ where: { sessionId } })).toBe(10);
    expect(await prisma.gameReplaySnapshot.count({ where: { sessionId } })).toBe(1);

    const replay = await request(app.getHttpServer())
      .get(`/games/sessions/${sessionId}/replay`)
      .set(opponentAuth)
      .expect(200);
    expect(replay.body).toEqual(
      expect.objectContaining({
        sessionId,
        definitionKey: 'pulse-duel',
        definitionVersion: 1,
        verified: true,
        reproducible: true,
        economicStake: null,
        actions: expect.any(Array)
      })
    );
    expect(replay.body.actions).toHaveLength(10);
    expect(typeof replay.body.seed).toBe('string');

    const exported = await accounts.exportData(ownerId);
    expect(exported.formatVersion).toBe(13);
    expect(exported.gamePlatform).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        economicStakeIncluded: false,
        activeSeedsIncluded: false
      })
    );
    expect(JSON.stringify(exported.gamePlatform)).not.toContain('"seed"');

    const lifecycleSession = await request(app.getHttpServer())
      .post('/games/sessions')
      .set(ownerAuth)
      .send({
        gameKey: 'pulse-duel',
        opponentUsernames: ['game_victim'],
        idempotencyKey: 'game:create:lifecycle'
      })
      .expect(201);
    const lifecycleSessionId = lifecycleSession.body.id as string;
    await request(app.getHttpServer())
      .post(`/games/sessions/${lifecycleSessionId}/join`)
      .set(victimAuth)
      .expect(201);

    const victimExport = await accounts.exportData(victimId);
    expect(victimExport.formatVersion).toBe(13);
    expect(JSON.stringify(victimExport.gamePlatform)).not.toContain('"seed"');

    await accounts.deleteAccount(victimId, { password: 'KnowMeTest123!' });
    const cancelled = await request(app.getHttpServer())
      .get(`/games/sessions/${lifecycleSessionId}`)
      .set(ownerAuth)
      .expect(200);
    expect(cancelled.body).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        result: { outcome: 'CANCELLED', reason: 'ACCOUNT_DELETED' }
      })
    );
    expect(cancelled.body.participants).toHaveLength(1);
    const lifecycleReplay = await request(app.getHttpServer())
      .get(`/games/sessions/${lifecycleSessionId}/replay`)
      .set(ownerAuth)
      .expect(200);
    expect(lifecycleReplay.body).toEqual(
      expect.objectContaining({ verified: true, reproducible: true })
    );
    expect(lifecycleReplay.body.result).toEqual({
      outcome: 'CANCELLED',
      reason: 'ACCOUNT_DELETED'
    });
  });
});
