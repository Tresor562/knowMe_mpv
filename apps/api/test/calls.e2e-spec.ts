import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { CallsService } from '../src/calls/calls.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe authoritative calls (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let calls: CallsService;

  beforeAll(async () => {
    process.env.CALL_MAINTENANCE_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    calls = app.get(CallsService);
    await prisma.callReceipt.deleteMany();
    await prisma.callEvent.deleteMany();
    await prisma.callSession.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.CALL_MAINTENANCE_ENABLED;
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  function auth(response: Awaited<ReturnType<typeof register>>) {
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  it('issues call IDs, governs signaling, records history and marks missed calls', async () => {
    const alice = await register('call-alice@knowme.test', 'call_alice', 'Call Alice');
    const bob = await register('call-bob@knowme.test', 'call_bob', 'Call Bob');
    const eve = await register('call-eve@knowme.test', 'call_eve', 'Call Eve');

    await request(app.getHttpServer())
      .post('/conversations')
      .set(auth(alice))
      .send({ title: 'Call Alice et Bob', memberIds: [bob.body.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post('/calls')
      .set(auth(eve))
      .send({
        calleeUserId: bob.body.user.id,
        media: 'audio',
        idempotencyKey: 'call:eve:forbidden:0001'
      })
      .expect(403);

    const payload = {
      calleeUserId: bob.body.user.id,
      media: 'video',
      idempotencyKey: 'call:alice:bob:0001'
    };
    const created = await request(app.getHttpServer())
      .post('/calls')
      .set(auth(alice))
      .send(payload)
      .expect(201);
    const callId = created.body.id as string;
    expect(callId).toEqual(expect.any(String));
    expect(created.body).toEqual(
      expect.objectContaining({
        status: 'RINGING',
        media: 'video',
        direction: 'OUTGOING',
        replayed: false,
        policy: expect.objectContaining({
          serverIssuedCallId: true,
          sessionDescriptionsPersisted: false,
          iceCandidatesPersisted: false,
          sharedConversationRequired: true
        })
      })
    );

    const replay = await request(app.getHttpServer())
      .post('/calls')
      .set(auth(alice))
      .send(payload)
      .expect(201);
    expect(replay.body.id).toBe(callId);
    expect(replay.body.replayed).toBe(true);
    expect(await prisma.callSession.count()).toBe(1);

    await expect(
      calls.authorizeSignal(
        alice.body.user.id,
        bob.body.user.id,
        'client-invented-call-id',
        'OFFER'
      )
    ).rejects.toBeDefined();

    await calls.authorizeSignal(
      alice.body.user.id,
      bob.body.user.id,
      callId,
      'OFFER'
    );
    await calls.authorizeSignal(
      bob.body.user.id,
      alice.body.user.id,
      callId,
      'ANSWER'
    );
    await calls.authorizeSignal(
      alice.body.user.id,
      bob.body.user.id,
      callId,
      'ICE'
    );

    const active = await request(app.getHttpServer())
      .get(`/calls/${callId}`)
      .set(auth(bob))
      .expect(200);
    expect(active.body.status).toBe('ACTIVE');
    expect(active.body.direction).toBe('INCOMING');
    expect(active.body.answeredAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/calls/${callId}/end`)
      .set(auth(bob))
      .send({ reason: 'ended' })
      .expect(201);
    const ended = await prisma.callSession.findUniqueOrThrow({ where: { id: callId } });
    expect(ended.status).toBe('ENDED');
    expect(ended.endReason).toBe('HANGUP');

    const missedCreated = await request(app.getHttpServer())
      .post('/calls')
      .set(auth(alice))
      .send({
        calleeUserId: bob.body.user.id,
        media: 'audio',
        idempotencyKey: 'call:alice:bob:missed:0001'
      })
      .expect(201);
    await prisma.callSession.update({
      where: { id: missedCreated.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });
    const maintenance = await calls.expireDue();
    expect(maintenance.missedCalls).toBe(1);
    const missed = await prisma.callSession.findUniqueOrThrow({
      where: { id: missedCreated.body.id }
    });
    expect(missed.status).toBe('MISSED');
    expect(missed.endReason).toBe('MISSED');
    expect(
      await prisma.notification.count({
        where: {
          userId: bob.body.user.id,
          type: 'CALL_MISSED'
        }
      })
    ).toBe(1);

    const history = await request(app.getHttpServer())
      .get('/calls/history')
      .set(auth(alice))
      .expect(200);
    expect(history.body).toHaveLength(2);
    expect(history.body.map((item: { status: string }) => item.status)).toEqual(
      expect.arrayContaining(['ENDED', 'MISSED'])
    );
    expect(JSON.stringify(history.body)).not.toMatch(/offer|answer|candidate|ipAddress/i);

    const exported = await calls.exportForAccount(alice.body.user.id);
    expect(exported).toEqual(
      expect.objectContaining({
        formatVersion: 1,
        sessionDescriptionsIncluded: false,
        iceCandidatesIncluded: false,
        networkAddressesIncluded: false,
        calls: expect.any(Array)
      })
    );
  });
});
