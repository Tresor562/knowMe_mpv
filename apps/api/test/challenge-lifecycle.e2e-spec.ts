import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe challenge lifecycle (e2e)', () => {
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

  it('lets a participant join, answer every question and blocks late joins', async () => {
    const creator = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'creator.s3@knowme.test',
        username: 'creator_s3',
        displayName: 'Creator',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const participant = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'participant.s3@knowme.test',
        username: 'participant_s3',
        displayName: 'Participant',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const challenge = await request(app.getHttpServer())
      .post('/challenges')
      .set('Authorization', `Bearer ${creator.body.accessToken}`)
      .send({
        title: 'Cycle complet',
        description: 'Validation du cycle de vie.',
        questions: ['Question une ?', 'Question deux ?']
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/challenges/${challenge.body.id}`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .expect(200);

    const answers = detail.body.questions.map((question: { id: string }, index: number) => ({
      questionId: question.id,
      value: `Réponse ${index + 1}`
    }));

    const submission = await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/answers`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .send({ answers })
      .expect(201);

    expect(submission.body.answers).toHaveLength(2);
    expect(submission.body.completedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .patch(`/challenges/${challenge.body.id}/complete`)
      .set('Authorization', `Bearer ${creator.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .expect(400);
  });
});
