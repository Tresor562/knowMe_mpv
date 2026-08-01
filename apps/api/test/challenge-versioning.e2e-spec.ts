import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe versioned challenges (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
        email: `${index}@versions.knowme.test`,
        username: `versions_${index}`,
        displayName: `Versions ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('freezes existing parties while publishing new challenge versions', async () => {
    const creator = await register('creator');
    const firstPlayer = await register('first');
    const secondPlayer = await register('second');
    const thirdPlayer = await register('third');

    const creatorToken = creator.body.accessToken as string;
    const firstToken = firstPlayer.body.accessToken as string;
    const secondToken = secondPlayer.body.accessToken as string;
    const thirdToken = thirdPlayer.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/challenges')
      .set(auth(creatorToken))
      .send({
        title: 'Défi version originale',
        description: 'Description de la version un.',
        visibility: 'PRIVATE',
        questions: ['Question v1 A ?', 'Question v1 B ?', 'Question v1 C ?']
      })
      .expect(201);

    const challengeId = created.body.id as string;
    expect(created.body).toEqual(
      expect.objectContaining({
        currentVersion: 1,
        visibility: 'PRIVATE',
        questions: expect.arrayContaining([
          expect.objectContaining({ version: 1, prompt: 'Question v1 A ?' })
        ])
      })
    );
    expect(created.body.participants[0].challengeVersion).toBe(1);

    const firstJoin = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(auth(firstToken))
      .expect(201);
    expect(firstJoin.body.challengeVersion).toBe(1);

    const firstV1 = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(firstToken))
      .expect(200);
    const firstQuestionId = firstV1.body.questions[0].id as string;

    await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(firstToken))
      .send({
        answers: [{ questionId: firstQuestionId, value: 'Réponse v1 conservée' }]
      })
      .expect(201);

    const versionTwo = await request(app.getHttpServer())
      .patch(`/challenges/${challengeId}`)
      .set(auth(creatorToken))
      .send({
        expectedVersion: 1,
        title: 'Défi version deux',
        description: 'Description de la version deux.',
        visibility: 'FRIENDS',
        questions: [
          'Question v2 A ?',
          'Question v2 B ?',
          'Question v2 C ?',
          'Question v2 D ?'
        ],
        changeReason: 'Clarification du thème et ajout d’une question.'
      })
      .expect(200);

    expect(versionTwo.body).toEqual(
      expect.objectContaining({
        currentVersion: 2,
        viewerVersion: 2,
        title: 'Défi version deux',
        visibility: 'FRIENDS'
      })
    );
    expect(versionTwo.body.questions).toHaveLength(4);
    expect(versionTwo.body.questions.every((item: { version: number }) => item.version === 2)).toBe(true);

    const frozenV1 = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(firstToken))
      .expect(200);

    expect(frozenV1.body).toEqual(
      expect.objectContaining({
        currentVersion: 2,
        viewerVersion: 1,
        isCurrentVersion: false,
        title: 'Défi version originale',
        description: 'Description de la version un.',
        visibility: 'PRIVATE'
      })
    );
    expect(frozenV1.body.questions.map((item: { prompt: string }) => item.prompt)).toEqual([
      'Question v1 A ?',
      'Question v1 B ?',
      'Question v1 C ?'
    ]);
    const frozenFirstParticipant = frozenV1.body.participants.find(
      (item: { userId: string }) => item.userId === firstPlayer.body.user.id
    );
    expect(frozenFirstParticipant.challengeVersion).toBe(1);
    expect(frozenFirstParticipant.answers).toEqual([
      expect.objectContaining({ questionId: firstQuestionId, value: 'Réponse v1 conservée' })
    ]);

    const secondJoin = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(auth(secondToken))
      .expect(201);
    expect(secondJoin.body.challengeVersion).toBe(2);

    const secondV2 = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(secondToken))
      .expect(200);
    expect(secondV2.body.viewerVersion).toBe(2);
    expect(secondV2.body.questions).toHaveLength(4);

    await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(firstToken))
      .send({
        answers: [
          {
            questionId: secondV2.body.questions[0].id,
            value: 'Tentative de réponse à une autre version'
          }
        ]
      })
      .expect(400);

    const firstCompletion = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(firstToken))
      .send({
        answers: frozenV1.body.questions.map(
          (question: { id: string }, index: number) => ({
            questionId: question.id,
            value: `Réponse finale v1 ${index + 1}`
          })
        )
      })
      .expect(201);
    expect(firstCompletion.body.reward.event).toEqual(
      expect.objectContaining({ status: 'AWARDED', amount: 25 })
    );

    const secondCompletion = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(secondToken))
      .send({
        answers: secondV2.body.questions.map(
          (question: { id: string }, index: number) => ({
            questionId: question.id,
            value: `Réponse finale v2 ${index + 1}`
          })
        )
      })
      .expect(201);
    expect(secondCompletion.body.reward.event).toEqual(
      expect.objectContaining({ status: 'AWARDED', amount: 25 })
    );

    await request(app.getHttpServer())
      .patch(`/challenges/${challengeId}`)
      .set(auth(firstToken))
      .send({
        expectedVersion: 2,
        title: 'Tentative non autorisée',
        questions: ['A ?', 'B ?', 'C ?'],
        changeReason: 'Tentative par un participant.'
      })
      .expect(403);

    const concurrentPayloads = [
      {
        expectedVersion: 2,
        title: 'Défi version trois A',
        visibility: 'PUBLIC',
        questions: ['V3 A1 ?', 'V3 A2 ?', 'V3 A3 ?', 'V3 A4 ?', 'V3 A5 ?'],
        changeReason: 'Première proposition concurrente.'
      },
      {
        expectedVersion: 2,
        title: 'Défi version trois B',
        visibility: 'PUBLIC',
        questions: ['V3 B1 ?', 'V3 B2 ?', 'V3 B3 ?'],
        changeReason: 'Deuxième proposition concurrente.'
      }
    ];

    const concurrentResponses = await Promise.all(
      concurrentPayloads.map((payload) =>
        request(app.getHttpServer())
          .patch(`/challenges/${challengeId}`)
          .set(auth(creatorToken))
          .send(payload)
      )
    );
    expect(concurrentResponses.map((response) => response.status).sort()).toEqual([200, 409]);

    const current = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(creatorToken))
      .expect(200);
    expect(current.body.currentVersion).toBe(3);
    expect(current.body.viewerVersion).toBe(3);

    const frozenV2AfterV3 = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(secondToken))
      .expect(200);
    expect(frozenV2AfterV3.body.viewerVersion).toBe(2);
    expect(frozenV2AfterV3.body.questions).toHaveLength(4);
    expect(frozenV2AfterV3.body.title).toBe('Défi version deux');

    const thirdJoin = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(auth(thirdToken))
      .expect(201);
    expect(thirdJoin.body.challengeVersion).toBe(3);

    const history = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}/versions`)
      .set(auth(creatorToken))
      .expect(200);
    expect(history.body.map((item: { version: number }) => item.version)).toEqual([3, 2, 1]);

    await request(app.getHttpServer())
      .get(`/challenges/${challengeId}/versions`)
      .set(auth(firstToken))
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/challenges/${challengeId}/complete`)
      .set(auth(creatorToken))
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/challenges/${challengeId}`)
      .set(auth(creatorToken))
      .send({
        expectedVersion: 3,
        title: 'Modification après clôture',
        questions: ['Impossible ?', 'Toujours impossible ?', 'Vraiment impossible ?'],
        changeReason: 'Cette modification doit être refusée.'
      })
      .expect(400);

    const [questionsByVersion, firstWallet, secondWallet, auditCount] = await Promise.all([
      prisma.challengeQuestion.groupBy({
        by: ['version'],
        where: { challengeId },
        _count: { _all: true },
        orderBy: { version: 'asc' }
      }),
      prisma.knowCoinWallet.findUnique({ where: { userId: firstPlayer.body.user.id } }),
      prisma.knowCoinWallet.findUnique({ where: { userId: secondPlayer.body.user.id } }),
      prisma.auditLog.count({
        where: { action: 'CHALLENGE_VERSION_PUBLISH', entityId: challengeId }
      })
    ]);

    expect(questionsByVersion[0]).toEqual(
      expect.objectContaining({ version: 1, _count: { _all: 3 } })
    );
    expect(questionsByVersion[1]).toEqual(
      expect.objectContaining({ version: 2, _count: { _all: 4 } })
    );
    expect([3, 5]).toContain(questionsByVersion[2]._count._all);
    expect(firstWallet?.balance).toBe(25);
    expect(secondWallet?.balance).toBe(25);
    expect(auditCount).toBe(2);
  });
});
