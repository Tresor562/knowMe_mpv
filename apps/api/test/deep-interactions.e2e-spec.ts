import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe deep interactions (e2e)', () => {
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
        email: `${index}@deep.knowme.test`,
        username: `deep_${index}`,
        displayName: `Deep ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('paginates comments and enforces deletion permissions', async () => {
    const author = await register('author');
    const commenter = await register('commenter');
    const outsider = await register('outsider');

    const post = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .send({ content: 'Une publication avec une discussion approfondie.' })
      .expect(201);

    const firstComment = await request(app.getHttpServer())
      .post(`/posts/${post.body.id}/comments`)
      .set('Authorization', `Bearer ${commenter.body.accessToken}`)
      .send({ content: 'Premier commentaire.' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/posts/${post.body.id}/comments/${firstComment.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/posts/${post.body.id}/comments/${firstComment.body.id}`)
      .set('Authorization', `Bearer ${commenter.body.accessToken}`)
      .expect(200, { deleted: true });

    const moderatedComment = await request(app.getHttpServer())
      .post(`/posts/${post.body.id}/comments`)
      .set('Authorization', `Bearer ${commenter.body.accessToken}`)
      .send({ content: 'Commentaire modéré par le propriétaire.' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/posts/${post.body.id}/comments/${moderatedComment.body.id}`)
      .set('Authorization', `Bearer ${author.body.accessToken}`)
      .expect(200, { deleted: true });

    await prisma.postComment.createMany({
      data: Array.from({ length: 35 }, (_, index) => ({
        postId: post.body.id as string,
        authorId: commenter.body.user.id as string,
        content: `Commentaire paginé ${String(index + 1).padStart(2, '0')}`
      }))
    });

    const firstPage = await request(app.getHttpServer())
      .get(`/posts/${post.body.id}/comments`)
      .expect(200);

    expect(firstPage.body).toHaveLength(30);
    expect(firstPage.body[0]).toMatchObject({
      content: 'Commentaire paginé 01',
      author: expect.objectContaining({ id: commenter.body.user.id })
    });

    const cursor = firstPage.body[29].id as string;
    const secondPage = await request(app.getHttpServer())
      .get(`/posts/${post.body.id}/comments?cursor=${cursor}`)
      .expect(200);

    expect(secondPage.body).toHaveLength(5);
    expect(secondPage.body[4].content).toBe('Commentaire paginé 35');
  });

  it('saves partial challenge progress, completes answers and locks a closed challenge', async () => {
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
