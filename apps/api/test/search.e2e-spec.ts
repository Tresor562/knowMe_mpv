import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe universal search authorization (e2e)', () => {
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

  it('returns matching private content only inside the caller authorization boundary', async () => {
    const alice = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'search.alice@knowme.test',
      username: 'search_alice',
      displayName: 'Alice Search',
      password: 'KnowMeTest123!'
    }).expect(201);
    const bob = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'search.bob@knowme.test',
      username: 'search_bob',
      displayName: 'Bob Search',
      password: 'KnowMeTest123!'
    }).expect(201);
    const outsider = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'search.outsider@knowme.test',
      username: 'search_outsider',
      displayName: 'Outsider Search',
      password: 'KnowMeTest123!'
    }).expect(201);

    const shared = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Project nebula', memberIds: [bob.body.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${shared.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'nebula visible shared message' })
      .expect(201);

    const hidden = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ title: 'Hidden nebula room', memberIds: [] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${hidden.body.id}/messages`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ content: 'nebula must stay hidden' })
      .expect(201);

    const result = await request(app.getHttpServer())
      .get('/search?q=nebula&limit=20')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(result.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'MESSAGE', snippet: 'nebula visible shared message' }),
        expect.objectContaining({ kind: 'CONVERSATION', id: shared.body.id })
      ])
    );
    expect(result.body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: hidden.body.id }),
        expect.objectContaining({ snippet: expect.stringContaining('must stay hidden') })
      ])
    );
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/search?q=nebula').expect(401);
  });
});
