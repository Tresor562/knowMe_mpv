import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe explainable affinity game (e2e)', () => {
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
    await prisma.affinityGamePreference.deleteMany();
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

  it('enforces friendship, consent, private explanations and deletion erasure', async () => {
    const owner = await register(
      'affinity-owner@knowme.test',
      'affinity_owner',
      'Affinity Owner'
    );
    const friend = await register(
      'affinity-friend@knowme.test',
      'affinity_friend',
      'Affinity Friend'
    );
    const stranger = await register(
      'affinity-stranger@knowme.test',
      'affinity_stranger',
      'Affinity Stranger'
    );

    const ownerId = owner.body.user.id as string;
    const friendId = friend.body.user.id as string;
    const ownerAuth = { Authorization: `Bearer ${owner.body.accessToken}` };
    const friendAuth = { Authorization: `Bearer ${friend.body.accessToken}` };
    const strangerAuth = { Authorization: `Bearer ${stranger.body.accessToken}` };

    const catalog = await request(app.getHttpServer())
      .get('/games/catalog')
      .expect(200);
    expect(catalog.body).toContainEqual(
      expect.objectContaining({
        key: 'affinity-mirror',
        version: 1,
        authoritativeServer: true,
        economicStakeAllowed: false
      })
    );

    const defaultPreference = await request(app.getHttpServer())
      .get('/games/affinity/preferences')
      .set(friendAuth)
      .expect(200);
    expect(defaultPreference.body).toEqual(
      expect.objectContaining({
        invitationsEnabled: true,
        friendsOnly: true,
        defaultShareAnswers: false,
        version: 0
      })
    );
    expect(await prisma.affinityGamePreference.count()).toBe(0);

    await request(app.getHttpServer())
      .post('/games/sessions')
      .set(ownerAuth)
      .send({
        gameKey: 'affinity-mirror',
        opponentUsernames: ['affinity_friend'],
        idempotencyKey: 'affinity:create:blocked-friendship'
      })
      .expect(403);

    await prisma.friendship.create({
      data: {
        requesterId: ownerId,
        addresseeId: friendId,
        status: 'ACCEPTED'
      }
    });
    await request(app.getHttpServer())
      .patch('/games/affinity/preferences')
      .set(friendAuth)
      .send({ invitationsEnabled: false })
      .expect(200);
    await request(app.getHttpServer())
      .post('/games/sessions')
      .set(ownerAuth)
      .send({
        gameKey: 'affinity-mirror',
        opponentUsernames: ['affinity_friend'],
        idempotencyKey: 'affinity:create:blocked-preference'
      })
      .expect(403);

    const updatedPreference = await request(app.getHttpServer())
      .patch('/games/affinity/preferences')
      .set(friendAuth)
      .send({
        invitationsEnabled: true,
        friendsOnly: true,
        defaultShareAnswers: false
      })
      .expect(200);
    expect(updatedPreference.body).toEqual(
      expect.objectContaining({
        invitationsEnabled: true,
        friendsOnly: true,
        defaultShareAnswers: false
      })
    );

    await request(app.getHttpServer())
      .post('/games/sessions')
      .set(strangerAuth)
      .send({
        gameKey: 'affinity-mirror',
        opponentUsernames: ['affinity_friend'],
        idempotencyKey: 'affinity:create:stranger'
      })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/games/sessions')
      .set(ownerAuth)
      .send({
        gameKey: 'affinity-mirror',
        opponentUsernames: ['affinity_friend'],
        idempotencyKey: 'affinity:create:primary'
      })
      .expect(201);
    const sessionId = created.body.id as string;
    expect(created.body).toEqual(
      expect.objectContaining({
        status: 'WAITING',
        sequence: 0,
        state: expect.objectContaining({
          phase: 'CONSENT',
          consentCount: 0,
          disclaimer: expect.stringContaining('ne mesure ni la qualité')
        })
      })
    );
    expect(JSON.stringify(created.body)).not.toContain('shareAnswers');

    let current = await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/join`)
      .set(friendAuth)
      .expect(201);
    expect(current.body.status).toBe('ACTIVE');

    current = await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/actions`)
      .set(ownerAuth)
      .send({
        actionType: 'CONSENT',
        payload: { accepted: true, shareAnswers: true },
        expectedSequence: 0,
        idempotencyKey: 'affinity:consent:owner'
      })
      .expect(201);
    expect(current.body.state).toEqual(
      expect.objectContaining({ phase: 'CONSENT', consentCount: 1 })
    );
    expect(JSON.stringify(current.body.state)).not.toContain('shareAnswers');

    current = await request(app.getHttpServer())
      .post(`/games/sessions/${sessionId}/actions`)
      .set(friendAuth)
      .send({
        actionType: 'CONSENT',
        payload: { accepted: true, shareAnswers: false },
        expectedSequence: 1,
        idempotencyKey: 'affinity:consent:friend'
      })
      .expect(201);
    expect(current.body.state).toEqual(
      expect.objectContaining({
        phase: 'QUESTIONS',
        questionIndex: 0,
        questionCount: 6
      })
    );

    for (let step = 0; step < 12; step += 1) {
      const turn = current.body.currentTurnPosition as number;
      const auth = turn === 0 ? ownerAuth : friendAuth;
      const option = (step + turn) % 4;
      current = await request(app.getHttpServer())
        .post(`/games/sessions/${sessionId}/actions`)
        .set(auth)
        .send({
          actionType: 'ANSWER',
          payload: { option },
          expectedSequence: current.body.sequence,
          idempotencyKey: `affinity:answer:${String(step + 1).padStart(2, '0')}`
        })
        .expect(201);
      if (current.body.status === 'ACTIVE') {
        expect(JSON.stringify(current.body.state)).not.toContain(`"option":${option}`);
      }
    }

    expect(current.body).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        sequence: 14,
        winnerUserId: null,
        result: expect.objectContaining({
          title: 'Instantané de préférences partagées',
          overallScore: expect.any(Number),
          exactMatches: expect.any(Number),
          categories: expect.any(Array),
          explanations: expect.any(Array),
          disclaimer: expect.stringContaining('ni un test psychologique'),
          detailedAnswersShared: false
        })
      })
    );
    expect(current.body.result.answerDetails).toBeUndefined();

    const replay = await request(app.getHttpServer())
      .get(`/games/sessions/${sessionId}/replay`)
      .set(ownerAuth)
      .expect(200);
    expect(replay.body).toEqual(
      expect.objectContaining({
        definitionKey: 'affinity-mirror',
        seed: null,
        verified: true,
        verificationScope: 'SERVER',
        reproducible: false,
        interpretable: true,
        privacyRedacted: true,
        detailedAnswersShared: false,
        economicStake: null
      })
    );
    expect(
      replay.body.actions
        .filter((action: { actionType: string }) => action.actionType === 'ANSWER')
        .every(
          (action: { payload: { redacted?: boolean } }) =>
            action.payload.redacted === true
        )
    ).toBe(true);
    expect(JSON.stringify(replay.body)).not.toContain('"option"');

    const exported = await accounts.exportData(friendId);
    expect(exported.formatVersion).toBe(14);
    expect(exported.gamePlatform).toEqual(
      expect.objectContaining({
        affinityPreference: expect.objectContaining({
          invitationsEnabled: true,
          friendsOnly: true,
          defaultShareAnswers: false
        })
      })
    );
    expect(JSON.stringify(exported.gamePlatform)).not.toContain('"seed"');

    await accounts.deleteAccount(friendId, { password: 'KnowMeTest123!' });
    expect(
      await prisma.affinityGamePreference.count({ where: { userId: friendId } })
    ).toBe(0);
    const remaining = await request(app.getHttpServer())
      .get(`/games/sessions/${sessionId}`)
      .set(ownerAuth)
      .expect(200);
    expect(remaining.body.participants).toHaveLength(1);

    const replayAfterDeletion = await request(app.getHttpServer())
      .get(`/games/sessions/${sessionId}/replay`)
      .set(ownerAuth)
      .expect(200);
    expect(replayAfterDeletion.body).toEqual(
      expect.objectContaining({
        verified: true,
        privacyRedacted: true,
        detailedAnswersShared: false,
        seed: null
      })
    );
    expect(JSON.stringify(replayAfterDeletion.body)).not.toContain('answerDetails');
    expect(JSON.stringify(replayAfterDeletion.body)).not.toContain('"option"');

    const storedSession = await prisma.gameSession.findUniqueOrThrow({
      where: { id: sessionId }
    });
    expect(JSON.stringify(storedSession.state)).not.toContain('answerDetails');
    const deletedActions = await prisma.gameAction.findMany({
      where: { sessionId, actorId: { startsWith: 'deleted-' } }
    });
    expect(deletedActions.length).toBeGreaterThan(0);
    expect(
      deletedActions.every(
        (action) =>
          (action.payload as { redacted?: boolean }).redacted === true
      )
    ).toBe(true);
  });
});
