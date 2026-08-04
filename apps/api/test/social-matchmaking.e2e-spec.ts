import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe voluntary social matchmaking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accounts: AccountService;

  beforeAll(async () => {
    process.env.SOCIAL_MATCHMAKING_MAINTENANCE_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    accounts = app.get(AccountService);

    await prisma.socialMatchReceipt.deleteMany();
    await prisma.socialMatchEvent.deleteMany();
    await prisma.socialMatchDecision.deleteMany();
    await prisma.socialMatchBlock.deleteMany();
    await prisma.socialMatchProposal.deleteMany();
    await prisma.socialMatchQueueEntry.deleteMany();
    await prisma.socialMatchPreference.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.SOCIAL_MATCHMAKING_MAINTENANCE_ENABLED;
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  const criteria = {
    purpose: 'LEARN',
    pace: 'FLEXIBLE',
    languages: ['fr', 'en'],
    topics: ['TECH', 'BOOKS', 'SCIENCE'],
    availability: [
      { dayOfWeek: 1, startMinute: 900, endMinute: 1020 },
      { dayOfWeek: 5, startMinute: 1080, endMinute: 1200 }
    ]
  };

  it('matches only opted-in users, explains proposals, supports decisions and erases account data', async () => {
    const alice = await register('match-alice@knowme.test', 'match_alice', 'Match Alice');
    const bob = await register('match-bob@knowme.test', 'match_bob', 'Match Bob');
    const carol = await register('match-carol@knowme.test', 'match_carol', 'Match Carol');
    const dan = await register('match-dan@knowme.test', 'match_dan', 'Match Dan');

    const aliceId = alice.body.user.id as string;
    const bobId = bob.body.user.id as string;
    const carolId = carol.body.user.id as string;
    const danId = dan.body.user.id as string;
    const aliceAuth = { Authorization: `Bearer ${alice.body.accessToken}` };
    const bobAuth = { Authorization: `Bearer ${bob.body.accessToken}` };
    const carolAuth = { Authorization: `Bearer ${carol.body.accessToken}` };
    const danAuth = { Authorization: `Bearer ${dan.body.accessToken}` };

    const legacyExport = await accounts.exportData(aliceId);
    expect(legacyExport.formatVersion).toBe(6);
    expect(legacyExport.socialMatchmaking).toBeUndefined();

    const defaults = await request(app.getHttpServer())
      .get('/social-matchmaking/preferences')
      .set(aliceAuth)
      .expect(200);
    expect(defaults.body).toEqual(
      expect.objectContaining({
        matchmakingEnabled: false,
        allowNewPeople: true,
        version: 0
      })
    );
    expect(await prisma.socialMatchPreference.count()).toBe(0);

    await request(app.getHttpServer())
      .post('/social-matchmaking/queue')
      .set(aliceAuth)
      .send({ ...criteria, idempotencyKey: 'match:alice:blocked' })
      .expect(403);

    for (const auth of [aliceAuth, bobAuth, carolAuth, danAuth]) {
      await request(app.getHttpServer())
        .patch('/social-matchmaking/preferences')
        .set(auth)
        .send({ matchmakingEnabled: true, allowNewPeople: true })
        .expect(200);
    }

    const aliceJoinPayload = {
      ...criteria,
      idempotencyKey: 'match:alice:join:0001'
    };
    const aliceQueued = await request(app.getHttpServer())
      .post('/social-matchmaking/queue')
      .set(aliceAuth)
      .send(aliceJoinPayload)
      .expect(201);
    expect(aliceQueued.body).toEqual(
      expect.objectContaining({
        replayed: false,
        queue: expect.objectContaining({ status: 'QUEUED', purpose: 'LEARN' }),
        proposal: null,
        sensitiveCriteriaUsed: false
      })
    );
    const replayedJoin = await request(app.getHttpServer())
      .post('/social-matchmaking/queue')
      .set(aliceAuth)
      .send(aliceJoinPayload)
      .expect(201);
    expect(replayedJoin.body.replayed).toBe(true);
    expect(await prisma.socialMatchQueueEntry.count({ where: { userId: aliceId } })).toBe(1);
    expect(await prisma.socialMatchReceipt.count({ where: { userId: aliceId } })).toBe(1);

    const bobMatched = await request(app.getHttpServer())
      .post('/social-matchmaking/queue')
      .set(bobAuth)
      .send({
        ...criteria,
        pace: 'ASYNC',
        topics: ['TECH', 'BOOKS', 'MUSIC'],
        availability: [
          { dayOfWeek: 1, startMinute: 960, endMinute: 1080 },
          { dayOfWeek: 5, startMinute: 1140, endMinute: 1260 }
        ],
        idempotencyKey: 'match:bob:join:0001'
      })
      .expect(201);
    expect(bobMatched.body.proposal).toEqual(
      expect.objectContaining({
        status: 'PENDING',
        score: expect.any(Number),
        partner: expect.objectContaining({ id: aliceId, username: 'match_alice' }),
        explanation: expect.objectContaining({
          sharedLanguages: ['en', 'fr'],
          sharedTopics: ['BOOKS', 'TECH'],
          overlapMinutes: 120,
          sensitiveCriteriaUsed: false,
          affinityAnswersUsed: false,
          privateMessagesUsed: false,
          preciseLocationUsed: false
        })
      })
    );
    const proposalId = bobMatched.body.proposal.id as string;
    expect(JSON.stringify(bobMatched.body.proposal)).not.toMatch(
      /affinityAnswer|privateMessage|latitude|longitude|religion|health|politic|financial/i
    );
    expect(
      await prisma.notification.count({
        where: { userId: { in: [aliceId, bobId] }, type: 'SOCIAL_MATCH_PROPOSAL' }
      })
    ).toBe(2);

    const aliceStatus = await request(app.getHttpServer())
      .get('/social-matchmaking/status')
      .set(aliceAuth)
      .expect(200);
    expect(aliceStatus.body.proposal.partner.id).toBe(bobId);

    const aliceAccept = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposalId}/decision`)
      .set(aliceAuth)
      .send({ decision: 'ACCEPT', idempotencyKey: 'match:alice:accept:0001' })
      .expect(201);
    expect(aliceAccept.body.proposal.status).toBe('PENDING');
    expect(aliceAccept.body.proposal.yourDecision).toBe('ACCEPT');

    const bobAcceptPayload = {
      decision: 'ACCEPT',
      idempotencyKey: 'match:bob:accept:0001'
    };
    const bobAccept = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposalId}/decision`)
      .set(bobAuth)
      .send(bobAcceptPayload)
      .expect(201);
    expect(bobAccept.body.proposal.status).toBe('ACCEPTED');
    expect(bobAccept.body.proposal.partner.id).toBe(aliceId);
    const bobAcceptReplay = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposalId}/decision`)
      .set(bobAuth)
      .send(bobAcceptPayload)
      .expect(201);
    expect(bobAcceptReplay.body.replayed).toBe(true);
    expect(
      await prisma.socialMatchDecision.count({ where: { proposalId } })
    ).toBe(2);

    const exported = await accounts.exportData(aliceId);
    expect(exported.formatVersion).toBe(15);
    expect(exported.socialMatchmaking).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        sensitiveCriteriaIncluded: false,
        affinityAnswersIncluded: false,
        privateMessagesIncluded: false,
        preciseLocationIncluded: false,
        proposals: expect.any(Array)
      })
    );
    expect(JSON.stringify(exported.socialMatchmaking)).not.toMatch(
      /latitude|longitude|religion|health|politic|financial/i
    );

    await request(app.getHttpServer())
      .post('/social-matchmaking/queue')
      .set(carolAuth)
      .send({ ...criteria, idempotencyKey: 'match:carol:join:0001' })
      .expect(201);
    const danMatched = await request(app.getHttpServer())
      .post('/social-matchmaking/queue')
      .set(danAuth)
      .send({ ...criteria, idempotencyKey: 'match:dan:join:0001' })
      .expect(201);
    const blockProposalId = danMatched.body.proposal.id as string;
    expect(blockProposalId).toBeTruthy();

    const carolBlocked = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${blockProposalId}/decision`)
      .set(carolAuth)
      .send({ decision: 'BLOCK', idempotencyKey: 'match:carol:block:0001' })
      .expect(201);
    expect(carolBlocked.body.proposal).toBeNull();
    expect(carolBlocked.body.queue.status).toBe('LEFT');
    expect(
      await prisma.socialMatchBlock.count({
        where: { blockerId: carolId, blockedId: danId }
      })
    ).toBe(1);

    const danStatus = await request(app.getHttpServer())
      .get('/social-matchmaking/status')
      .set(danAuth)
      .expect(200);
    expect(danStatus.body.queue.status).toBe('QUEUED');
    expect(danStatus.body.proposal).toBeNull();

    const blocks = await request(app.getHttpServer())
      .get('/social-matchmaking/blocks')
      .set(carolAuth)
      .expect(200);
    expect(blocks.body).toContainEqual(
      expect.objectContaining({ blockedId: danId })
    );
    await request(app.getHttpServer())
      .delete(`/social-matchmaking/blocks/${danId}`)
      .set(carolAuth)
      .expect(200);
    expect(await prisma.socialMatchBlock.count()).toBe(0);

    await request(app.getHttpServer())
      .delete('/social-matchmaking/queue')
      .set(danAuth)
      .expect(200);
    const danLeft = await request(app.getHttpServer())
      .get('/social-matchmaking/status')
      .set(danAuth)
      .expect(200);
    expect(danLeft.body.queue.status).toBe('LEFT');

    await accounts.deleteAccount(bobId, { password: 'KnowMeTest123!' });
    expect(await prisma.socialMatchPreference.count({ where: { userId: bobId } })).toBe(0);
    expect(await prisma.socialMatchQueueEntry.count({ where: { userId: bobId } })).toBe(0);
    expect(await prisma.socialMatchDecision.count({ where: { userId: bobId } })).toBe(0);
    expect(await prisma.socialMatchReceipt.count({ where: { userId: bobId } })).toBe(0);
    const acceptedAfterDeletion = await prisma.socialMatchProposal.findUniqueOrThrow({
      where: { id: proposalId }
    });
    expect(acceptedAfterDeletion.status).toBe('ACCEPTED');
    expect(
      [acceptedAfterDeletion.firstUserId, acceptedAfterDeletion.secondUserId].some(
        (id) => id.startsWith('deleted-')
      )
    ).toBe(true);

    const aliceAfterDeletion = await request(app.getHttpServer())
      .get('/social-matchmaking/status')
      .set(aliceAuth)
      .expect(200);
    expect(aliceAfterDeletion.body.proposal.status).toBe('ACCEPTED');
    expect(aliceAfterDeletion.body.proposal.partner).toBeNull();
  });
});
