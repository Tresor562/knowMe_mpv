import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AccountService } from '../src/account/account.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SocialConnectionService } from '../src/social-matchmaking/social-connection.service';

describe('KnowMe post-acceptance social connection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accounts: AccountService;
  let connections: SocialConnectionService;

  beforeAll(async () => {
    process.env.SOCIAL_MATCHMAKING_MAINTENANCE_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    accounts = app.get(AccountService);
    connections = app.get(SocialConnectionService);

    await prisma.socialConnectionReceipt.deleteMany();
    await prisma.socialConnectionEvent.deleteMany();
    await prisma.socialConnectionOutcome.deleteMany();
    await prisma.socialConnectionIntent.deleteMany();
    await prisma.socialMatchReceipt.deleteMany();
    await prisma.socialMatchEvent.deleteMany();
    await prisma.socialMatchDecision.deleteMany();
    await prisma.socialMatchBlock.deleteMany();
    await prisma.socialMatchProposal.deleteMany();
    await prisma.socialMatchQueueEntry.deleteMany();
    await prisma.socialMatchPreference.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversationMember.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.friendship.deleteMany();
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

  async function acceptedProposal(firstUserId: string, secondUserId: string, acceptedAt = new Date()) {
    return prisma.socialMatchProposal.create({
      data: {
        firstUserId,
        secondUserId,
        firstEntryId: `test-entry:${firstUserId}`,
        secondEntryId: `test-entry:${secondUserId}`,
        status: 'ACCEPTED',
        score: 80,
        explanation: {
          sharedLanguages: ['fr'],
          sharedTopics: ['TECH'],
          overlapMinutes: 60,
          sensitiveCriteriaUsed: false,
          affinityAnswersUsed: false,
          privateMessagesUsed: false,
          preciseLocationUsed: false
        },
        acceptedAt,
        expiresAt: new Date(acceptedAt.getTime() + 24 * 60 * 60 * 1_000)
      }
    });
  }

  it('executes only the private mutual intersection and preserves account lifecycle guarantees', async () => {
    const alice = await register('connection-alice@knowme.test', 'connection_alice', 'Connection Alice');
    const bob = await register('connection-bob@knowme.test', 'connection_bob', 'Connection Bob');
    const carol = await register('connection-carol@knowme.test', 'connection_carol', 'Connection Carol');

    const aliceId = alice.body.user.id as string;
    const bobId = bob.body.user.id as string;
    const carolId = carol.body.user.id as string;
    const aliceAuth = { Authorization: `Bearer ${alice.body.accessToken}` };
    const bobAuth = { Authorization: `Bearer ${bob.body.accessToken}` };
    const carolAuth = { Authorization: `Bearer ${carol.body.accessToken}` };

    const proposal = await acceptedProposal(aliceId, bobId);

    await request(app.getHttpServer())
      .get(`/social-matchmaking/proposals/${proposal.id}/connection`)
      .set(carolAuth)
      .expect(403);

    const initial = await request(app.getHttpServer())
      .get(`/social-matchmaking/proposals/${proposal.id}/connection`)
      .set(aliceAuth)
      .expect(200);
    expect(initial.body).toEqual(
      expect.objectContaining({
        available: true,
        intent: null,
        partnerResponded: false,
        result: expect.objectContaining({
          friendshipCreated: false,
          conversationCreated: false
        }),
        privacy: {
          partnerChoicesExposed: false,
          automaticConnectionAllowed: false
        }
      })
    );

    const aliceIntentPayload = {
      wantsFriendship: true,
      wantsConversation: true,
      idempotencyKey: 'connection:alice:intent:0001'
    };
    const aliceIntent = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposal.id}/connection/intent`)
      .set(aliceAuth)
      .send(aliceIntentPayload)
      .expect(201);
    expect(aliceIntent.body.replayed).toBe(false);
    expect(aliceIntent.body.intent).toEqual(
      expect.objectContaining({
        wantsFriendship: true,
        wantsConversation: true,
        status: 'ACTIVE'
      })
    );
    expect(aliceIntent.body.partnerResponded).toBe(false);
    expect(await prisma.friendship.count()).toBe(0);
    expect(await prisma.conversation.count()).toBe(0);

    const aliceReplay = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposal.id}/connection/intent`)
      .set(aliceAuth)
      .send(aliceIntentPayload)
      .expect(201);
    expect(aliceReplay.body.replayed).toBe(true);
    expect(
      await prisma.socialConnectionReceipt.count({
        where: { userId: aliceId, operation: 'SET_INTENT' }
      })
    ).toBe(1);

    const bobBeforeChoice = await request(app.getHttpServer())
      .get(`/social-matchmaking/proposals/${proposal.id}/connection`)
      .set(bobAuth)
      .expect(200);
    expect(bobBeforeChoice.body.partnerResponded).toBe(true);
    expect(bobBeforeChoice.body.intent).toBeNull();
    expect(bobBeforeChoice.body).not.toHaveProperty('partnerIntent');
    expect(JSON.stringify(bobBeforeChoice.body)).not.toContain('wantsFriendship":true');

    const bobFriendship = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposal.id}/connection/intent`)
      .set(bobAuth)
      .send({
        wantsFriendship: true,
        wantsConversation: false,
        idempotencyKey: 'connection:bob:intent:0001'
      })
      .expect(201);
    expect(bobFriendship.body.result).toEqual(
      expect.objectContaining({
        friendshipCreated: true,
        conversationCreated: false,
        friendshipId: expect.any(String),
        conversationId: null
      })
    );
    expect(await prisma.friendship.count({ where: { status: 'ACCEPTED' } })).toBe(1);
    expect(await prisma.conversation.count()).toBe(0);

    const bobBoth = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposal.id}/connection/intent`)
      .set(bobAuth)
      .send({
        wantsFriendship: true,
        wantsConversation: true,
        idempotencyKey: 'connection:bob:intent:0002'
      })
      .expect(201);
    expect(bobBoth.body.result).toEqual(
      expect.objectContaining({
        friendshipCreated: true,
        conversationCreated: true,
        friendshipId: expect.any(String),
        conversationId: expect.any(String)
      })
    );
    expect(await prisma.friendship.count({ where: { status: 'ACCEPTED' } })).toBe(1);
    expect(await prisma.conversation.count({ where: { isGroup: false } })).toBe(1);
    expect(await prisma.conversationMember.count()).toBe(2);

    await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${proposal.id}/connection/revoke`)
      .set(aliceAuth)
      .send({ idempotencyKey: 'connection:alice:revoke:after-result' })
      .expect(409);

    const revocableProposal = await acceptedProposal(aliceId, carolId);
    await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${revocableProposal.id}/connection/intent`)
      .set(aliceAuth)
      .send({
        wantsFriendship: false,
        wantsConversation: true,
        idempotencyKey: 'connection:alice:carol:intent'
      })
      .expect(201);
    const revoked = await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${revocableProposal.id}/connection/revoke`)
      .set(aliceAuth)
      .send({ idempotencyKey: 'connection:alice:carol:revoke' })
      .expect(201);
    expect(revoked.body.intent.status).toBe('REVOKED');
    expect(await prisma.conversation.count()).toBe(1);

    const expiredProposal = await acceptedProposal(
      aliceId,
      carolId,
      new Date(Date.now() - 74 * 60 * 60 * 1_000)
    );
    await prisma.socialConnectionIntent.create({
      data: {
        proposalId: expiredProposal.id,
        userId: aliceId,
        wantsFriendship: true,
        wantsConversation: false,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 60_000)
      }
    });
    expect(await connections.expireDue(10)).toEqual({ expiredConnectionIntents: 1 });
    expect(
      await prisma.socialConnectionIntent.findUniqueOrThrow({
        where: {
          proposalId_userId: { proposalId: expiredProposal.id, userId: aliceId }
        }
      })
    ).toEqual(expect.objectContaining({ status: 'EXPIRED' }));
    await request(app.getHttpServer())
      .post(`/social-matchmaking/proposals/${expiredProposal.id}/connection/intent`)
      .set(carolAuth)
      .send({
        wantsFriendship: true,
        wantsConversation: false,
        idempotencyKey: 'connection:carol:expired:intent'
      })
      .expect(409);

    const exported = await accounts.exportData(aliceId);
    expect(exported.formatVersion).toBe(16);
    expect(exported.socialMatchmaking.postAcceptanceConnection).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        partnerChoicesIncluded: false,
        automaticConnectionsIncluded: false,
        intents: expect.any(Array),
        outcomes: expect.any(Array),
        events: expect.any(Array)
      })
    );
    expect(
      exported.socialMatchmaking.postAcceptanceConnection.intents.every(
        (intent: Record<string, unknown>) => !('userId' in intent)
      )
    ).toBe(true);

    await accounts.deleteAccount(bobId, { password: 'KnowMeTest123!' });
    expect(await prisma.socialConnectionIntent.count({ where: { userId: bobId } })).toBe(0);
    expect(await prisma.socialConnectionReceipt.count({ where: { userId: bobId } })).toBe(0);
    expect(await prisma.socialConnectionEvent.count({ where: { userId: bobId } })).toBe(0);
    expect(
      await prisma.socialConnectionOutcome.count({ where: { proposalId: proposal.id } })
    ).toBe(0);

    const aliceAfterDeletion = await request(app.getHttpServer())
      .get(`/social-matchmaking/proposals/${proposal.id}/connection`)
      .set(aliceAuth)
      .expect(200);
    expect(aliceAfterDeletion.body.available).toBe(false);
    expect(aliceAfterDeletion.body.result).toEqual(
      expect.objectContaining({
        friendshipCreated: false,
        conversationCreated: false
      })
    );
  });
});
