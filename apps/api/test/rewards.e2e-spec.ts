import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe reward engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@rewards.knowme.test`,
        username: `rewards_${index}`,
        displayName: `Rewards ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  async function createChallenge(
    token: string,
    index: string,
    questionCount = 3
  ) {
    return request(app.getHttpServer())
      .post('/challenges')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Défi récompense ${index}`,
        description: 'Défi de validation du moteur de récompenses.',
        questions: Array.from(
          { length: questionCount },
          (_, questionIndex) => `Question ${questionIndex + 1} du défi ${index} ?`
        )
      })
      .expect(201);
  }

  async function join(token: string, challengeId: string) {
    return request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
  }

  async function answer(
    token: string,
    challenge: { id: string; questions: Array<{ id: string }> },
    suffix = 'initiale'
  ) {
    return request(app.getHttpServer())
      .post(`/challenges/${challenge.id}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: challenge.questions.map((question, index) => ({
          questionId: question.id,
          value: `Réponse ${suffix} ${index + 1}`
        }))
      })
      .expect(201);
  }

  it('awards only verified first completions and enforces anti-abuse limits', async () => {
    const admin = await register('admin');
    const creator = await register('creator');
    const participant = await register('participant');

    await prisma.user.update({
      where: { id: admin.body.user.id },
      data: { role: 'ADMIN' }
    });

    const adminToken = admin.body.accessToken as string;
    const creatorToken = creator.body.accessToken as string;
    const participantToken = participant.body.accessToken as string;
    const participantId = participant.body.user.id as string;

    const preview = await request(app.getHttpServer())
      .get('/rewards/preview?eventType=CHALLENGE_COMPLETION')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);

    expect(preview.body).toEqual(
      expect.objectContaining({
        key: 'challenge_completion',
        version: 1,
        amount: 25,
        dailyLimitPerUser: 100,
        minQuestions: 3
      })
    );

    const eligible = await createChallenge(creatorToken, 'eligible');
    await join(participantToken, eligible.body.id);

    const firstCompletion = await answer(participantToken, eligible.body);
    expect(firstCompletion.body.reward).toEqual(
      expect.objectContaining({
        replayed: false,
        event: expect.objectContaining({
          status: 'AWARDED',
          amount: 25,
          reasonCode: 'ELIGIBLE'
        })
      })
    );

    const walletAfterFirst = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);
    expect(walletAfterFirst.body.balance).toBe(25);

    const edited = await answer(participantToken, eligible.body, 'modifiée');
    expect(edited.body.reward).toBeNull();

    const walletAfterEdit = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);
    expect(walletAfterEdit.body.balance).toBe(25);

    const selfChallenge = await createChallenge(creatorToken, 'self');
    const selfCompletion = await answer(creatorToken, selfChallenge.body);
    expect(selfCompletion.body.reward.event).toEqual(
      expect.objectContaining({
        status: 'IGNORED',
        amount: 0,
        reasonCode: 'SELF_CHALLENGE'
      })
    );

    const shortChallenge = await createChallenge(creatorToken, 'short', 2);
    await join(participantToken, shortChallenge.body.id);
    const shortCompletion = await answer(participantToken, shortChallenge.body);
    expect(shortCompletion.body.reward.event).toEqual(
      expect.objectContaining({
        status: 'IGNORED',
        amount: 0,
        reasonCode: 'MIN_QUESTIONS'
      })
    );

    for (let index = 2; index <= 4; index += 1) {
      const challenge = await createChallenge(creatorToken, `daily-${index}`);
      await join(participantToken, challenge.body.id);
      const completion = await answer(participantToken, challenge.body);
      expect(completion.body.reward.event.status).toBe('AWARDED');
      expect(completion.body.reward.event.amount).toBe(25);
    }

    const overLimit = await createChallenge(creatorToken, 'daily-limit');
    await join(participantToken, overLimit.body.id);
    const rejected = await answer(participantToken, overLimit.body);
    expect(rejected.body.reward.event).toEqual(
      expect.objectContaining({
        status: 'REJECTED',
        amount: 0,
        reasonCode: 'DAILY_LIMIT'
      })
    );

    const cappedWallet = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);
    expect(cappedWallet.body.balance).toBe(100);

    const concurrent = await createChallenge(creatorToken, 'concurrent');
    const secondParticipant = await register('concurrent');
    const secondParticipantToken = secondParticipant.body.accessToken as string;
    await join(secondParticipantToken, concurrent.body.id);

    await Promise.all([
      answer(secondParticipantToken, concurrent.body, 'A'),
      answer(secondParticipantToken, concurrent.body, 'B')
    ]);

    const concurrentParticipant = await prisma.challengeParticipant.findUnique({
      where: {
        challengeId_userId: {
          challengeId: concurrent.body.id,
          userId: secondParticipant.body.user.id
        }
      }
    });
    const concurrentEventCount = await prisma.rewardEvent.count({
      where: {
        idempotencyKey: `reward:challenge-completion:${concurrentParticipant?.id}`
      }
    });
    const concurrentLedgerCount = await prisma.knowCoinLedgerEntry.count({
      where: {
        referenceType: 'CHALLENGE_PARTICIPANT',
        referenceId: concurrentParticipant?.id
      }
    });
    const secondWallet = await prisma.knowCoinWallet.findUnique({
      where: { userId: secondParticipant.body.user.id }
    });

    expect(concurrentEventCount).toBe(1);
    expect(concurrentLedgerCount).toBe(1);
    expect(secondWallet?.balance).toBe(25);

    const history = await request(app.getHttpServer())
      .get('/rewards/me')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);

    expect(history.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'AWARDED', amount: 25 }),
        expect.objectContaining({ status: 'IGNORED', reasonCode: 'MIN_QUESTIONS' }),
        expect.objectContaining({ status: 'REJECTED', reasonCode: 'DAILY_LIMIT' })
      ])
    );

    await request(app.getHttpServer())
      .get('/admin/rewards/policies')
      .set('Authorization', `Bearer ${participantToken}`)
      .set('x-permissions', 'rewards.manage')
      .expect(403);

    const policyCreation = await request(app.getHttpServer())
      .post('/admin/rewards/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'test_event_policy',
        eventType: 'TEST_EVENT',
        amount: 10,
        dailyLimitPerUser: 20,
        maxPerEntity: 1,
        minQuestions: 0,
        reason: 'Politique de validation administrative.'
      })
      .expect(201);

    expect(policyCreation.body).toEqual(
      expect.objectContaining({
        key: 'test_event_policy',
        version: 1,
        eventType: 'TEST_EVENT',
        enabled: true
      })
    );

    await request(app.getHttpServer())
      .patch(`/admin/rewards/policies/${policyCreation.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        enabled: false,
        reason: 'Fin de la validation administrative.'
      })
      .expect(200);

    const audit = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(audit.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'REWARD_POLICY_CREATE',
          actorId: admin.body.user.id
        }),
        expect.objectContaining({
          action: 'REWARD_POLICY_DISABLE',
          actorId: admin.body.user.id
        })
      ])
    );

    const awardedEvents = await prisma.rewardEvent.count({
      where: { userId: participantId, status: 'AWARDED' }
    });
    const participantLedger = await prisma.knowCoinLedgerEntry.count({
      where: { userId: participantId, source: 'REWARD' }
    });

    expect(awardedEvents).toBe(4);
    expect(participantLedger).toBe(4);
  });
});
