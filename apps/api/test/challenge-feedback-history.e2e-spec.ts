import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe challenge feedback and history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.challengeResultSnapshot.deleteMany();
    await prisma.challengeReferenceSnapshot.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}@feedback.knowme.test`,
        username: `feedback_${label}`,
        displayName: `Feedback ${label}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('scores against immutable references and preserves versioned history', async () => {
    const creator = await register('creator');
    const player = await register('player');
    const pendingPlayer = await register('pending');
    const intruder = await register('intruder');

    const creatorToken = creator.body.accessToken as string;
    const playerToken = player.body.accessToken as string;
    const pendingToken = pendingPlayer.body.accessToken as string;
    const intruderToken = intruder.body.accessToken as string;

    const created = await request(app.getHttpServer())
      .post('/challenges')
      .set(auth(creatorToken))
      .send({
        title: 'Qui me connaît vraiment ?',
        description: 'Réponses de référence verrouillées côté serveur.',
        visibility: 'PRIVATE',
        questions: [
          'Dans quelle ville suis-je né ?',
          'Quelle est ma couleur préférée ?',
          'Quel plat je choisis souvent ?'
        ]
      })
      .expect(201);

    const challengeId = created.body.id as string;
    const creatorAnswers = created.body.questions.map(
      (question: { id: string }, index: number) => ({
        questionId: question.id,
        value: ['Cotonou', 'Bleu', 'Pizza'][index]
      })
    );

    const referenceCompletion = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(creatorToken))
      .send({ answers: creatorAnswers })
      .expect(201);

    expect(referenceCompletion.body).toEqual(
      expect.objectContaining({
        result: null,
        referenceLocked: true,
        answersLocked: true,
        reference: expect.objectContaining({
          challengeVersion: 1,
          questionCount: 3
        })
      })
    );
    expect(referenceCompletion.body.reference.answers).toBeUndefined();

    const creatorReplay = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(creatorToken))
      .send({
        answers: creatorAnswers.map((answer: { questionId: string }) => ({
          questionId: answer.questionId,
          value: 'Tentative de réécriture'
        }))
      })
      .expect(201);
    expect(creatorReplay.body.answersLocked).toBe(true);
    expect(creatorReplay.body.answers[0].value).toBe('Cotonou');

    const joined = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(auth(playerToken))
      .expect(201);
    const participantId = joined.body.id as string;

    const playerDetail = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(playerToken))
      .expect(200);

    const scored = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(playerToken))
      .send({
        answers: playerDetail.body.questions.map(
          (question: { id: string }, index: number) => ({
            questionId: question.id,
            value: ['  COTONOU  ', 'bleu', 'Riz'][index]
          })
        )
      })
      .expect(201);

    expect(scored.body.result).toEqual(
      expect.objectContaining({
        participantId,
        status: 'SCORED',
        score: 67,
        correctCount: 2,
        questionCount: 3
      })
    );
    expect(scored.body.result.feedback.map((item: { correct: boolean }) => item.correct)).toEqual([
      true,
      true,
      false
    ]);
    expect(scored.body.result.feedback[2].expectedAnswer).toBe('Pizza');

    const immutableReplay = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(playerToken))
      .send({
        answers: playerDetail.body.questions.map((question: { id: string }) => ({
          questionId: question.id,
          value: 'Pizza'
        }))
      })
      .expect(201);
    expect(immutableReplay.body.answersLocked).toBe(true);
    expect(immutableReplay.body.result.score).toBe(67);
    expect(immutableReplay.body.reward).toBeNull();

    const history = await request(app.getHttpServer())
      .get('/challenges/history')
      .set(auth(playerToken))
      .expect(200);
    expect(history.body.items).toEqual([
      expect.objectContaining({
        challengeId,
        participantId,
        challengeVersion: 1,
        status: 'SCORED',
        score: 67,
        challenge: expect.objectContaining({ title: 'Qui me connaît vraiment ?' })
      })
    ]);

    await request(app.getHttpServer())
      .get(`/challenges/${challengeId}/results/${participantId}`)
      .set(auth(playerToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/challenges/${challengeId}/results/${participantId}`)
      .set(auth(creatorToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/challenges/${challengeId}/results/${participantId}`)
      .set(auth(intruderToken))
      .expect(403);

    const creatorDetail = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(creatorToken))
      .expect(200);
    const playerInCreatorView = creatorDetail.body.participants.find(
      (participant: { id: string }) => participant.id === participantId
    );
    expect(playerInCreatorView.answers).toEqual([]);
    expect(playerInCreatorView.result.score).toBe(67);

    const versionTwo = await request(app.getHttpServer())
      .patch(`/challenges/${challengeId}`)
      .set(auth(creatorToken))
      .send({
        expectedVersion: 1,
        title: 'Qui me connaît vraiment — saison 2',
        visibility: 'FRIENDS',
        questions: ['Mon langage favori ?', 'Mon système préféré ?', 'Mon domaine principal ?'],
        changeReason: 'Nouvelle série technique.'
      })
      .expect(200);

    const pendingJoin = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/join`)
      .set(auth(pendingToken))
      .expect(201);
    expect(pendingJoin.body.challengeVersion).toBe(2);

    const pendingDetail = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}`)
      .set(auth(pendingToken))
      .expect(200);
    const pendingCompletion = await request(app.getHttpServer())
      .post(`/challenges/${challengeId}/answers`)
      .set(auth(pendingToken))
      .send({
        answers: pendingDetail.body.questions.map(
          (question: { id: string }, index: number) => ({
            questionId: question.id,
            value: ['TypeScript', 'Linux', 'Cybersécurité'][index]
          })
        )
      })
      .expect(201);
    expect(pendingCompletion.body.result.status).toBe('PENDING_REFERENCE');
    expect(pendingCompletion.body.result.feedback).toBeNull();

    const reference = await request(app.getHttpServer())
      .put(`/challenges/${challengeId}/versions/2/reference`)
      .set(auth(creatorToken))
      .send({
        answers: versionTwo.body.questions.map(
          (question: { id: string }, index: number) => ({
            questionId: question.id,
            value: ['TypeScript', 'Linux', 'Intelligence artificielle'][index]
          })
        )
      })
      .expect(200);
    expect(reference.body).toEqual(
      expect.objectContaining({ challengeVersion: 2, scoredResults: 1 })
    );
    expect(reference.body.answers).toBeUndefined();

    await request(app.getHttpServer())
      .put(`/challenges/${challengeId}/versions/2/reference`)
      .set(auth(creatorToken))
      .send({
        answers: versionTwo.body.questions.map((question: { id: string }) => ({
          questionId: question.id,
          value: 'Réécriture interdite'
        }))
      })
      .expect(409);

    const reconciled = await request(app.getHttpServer())
      .get(`/challenges/${challengeId}/results/${pendingJoin.body.id}`)
      .set(auth(pendingToken))
      .expect(200);
    expect(reconciled.body).toEqual(
      expect.objectContaining({
        status: 'SCORED',
        score: 67,
        correctCount: 2,
        questionCount: 3
      })
    );

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set(auth(playerToken))
      .expect(200);
    expect(exported.body.formatVersion).toBe(6);
    expect(exported.body.challengeHistory).toEqual([
      expect.objectContaining({ participantId, score: 67 })
    ]);

    const referenceRow = await prisma.challengeReferenceSnapshot.findUnique({
      where: {
        challengeId_challengeVersion: { challengeId, challengeVersion: 1 }
      }
    });
    expect(referenceRow).not.toBeNull();
    expect(JSON.stringify(referenceRow?.answers)).not.toContain('Tentative de réécriture');

    const auditCount = await prisma.auditLog.count({
      where: { action: 'CHALLENGE_REFERENCE_LOCK', entity: 'ChallengeReferenceSnapshot' }
    });
    expect(auditCount).toBe(2);
  });
});
