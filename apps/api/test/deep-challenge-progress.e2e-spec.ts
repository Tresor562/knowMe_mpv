import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe deep challenge progress (e2e)', () => {
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
        email: `${index}@challenge.knowme.test`,
        username: `challenge_${index}`,
        displayName: `Challenge ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('saves partial progress, completes answers and locks a closed challenge', async () => {
    const creator = await register('creator');
    const participant = await register('participant');
    const lateUser = await register('late');

    const challenge = await request(app.getHttpServer())
      .post('/challenges')
      .set('Authorization', `Bearer ${creator.body.accessToken}`)
      .send({
        title: 'Défi progressif',
        description: 'Réponses sauvegardées en plusieurs étapes.',
        questions: ['Question une ?', 'Question deux ?', 'Question trois ?']
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

    const questionIds = (detail.body.questions as Array<{ id: string }>).map((item) => item.id);

    const partial = await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/answers`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .send({
        answers: [
          { questionId: questionIds[0], value: 'Réponse une' },
          { questionId: questionIds[1], value: 'Réponse deux' }
        ]
      })
      .expect(201);

    expect(partial.body.completedAt).toBeNull();
    expect(partial.body.answers).toHaveLength(2);

    const completed = await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/answers`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .send({
        answers: [{ questionId: questionIds[2], value: 'Réponse trois' }]
      })
      .expect(201);

    expect(completed.body.completedAt).toEqual(expect.any(String));
    expect(completed.body.answers).toHaveLength(3);

    await request(app.getHttpServer())
      .patch(`/challenges/${challenge.body.id}/complete`)
      .set('Authorization', `Bearer ${creator.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/answers`)
      .set('Authorization', `Bearer ${participant.body.accessToken}`)
      .send({ answers: [{ questionId: questionIds[0], value: 'Modification tardive' }] })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/challenges/${challenge.body.id}/join`)
      .set('Authorization', `Bearer ${lateUser.body.accessToken}`)
      .expect(400);
  });
});
