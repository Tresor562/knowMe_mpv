import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe deep publication interactions (e2e)', () => {
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

    const expectedContents = Array.from(
      { length: 35 },
      (_, index) => `Commentaire paginé ${String(index + 1).padStart(2, '0')}`
    );

    await prisma.postComment.createMany({
      data: expectedContents.map((content) => ({
        postId: post.body.id as string,
        authorId: commenter.body.user.id as string,
        content
      }))
    });

    const firstPage = await request(app.getHttpServer())
      .get(`/posts/${post.body.id}/comments`)
      .expect(200);

    expect(firstPage.body).toHaveLength(30);
    expect(firstPage.body[0]).toMatchObject({
      author: expect.objectContaining({ id: commenter.body.user.id })
    });

    const cursor = firstPage.body[29].id as string;
    const secondPage = await request(app.getHttpServer())
      .get(`/posts/${post.body.id}/comments?cursor=${cursor}`)
      .expect(200);

    expect(secondPage.body).toHaveLength(5);

    const combined = [...firstPage.body, ...secondPage.body] as Array<{ id: string; content: string }>;
    expect(new Set(combined.map((item) => item.id)).size).toBe(35);
    expect(combined.map((item) => item.content).sort()).toEqual(expectedContents.sort());
  });
});
