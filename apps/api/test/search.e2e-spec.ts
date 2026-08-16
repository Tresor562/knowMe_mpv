import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe universal search authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registrationIpOctet = 40;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(email: string, username: string, displayName: string) {
    const sourceIp = `198.51.100.${registrationIpOctet++}`;
    return request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', sourceIp)
      .send({ email, username, displayName, password: 'KnowMeTest123!' })
      .expect(201);
  }

  it('returns matching private content only inside the caller authorization boundary', async () => {
    const alice = await register(
      'search.alice@knowme.test',
      'search_alice',
      'Alice Search'
    );
    const bob = await register(
      'search.bob@knowme.test',
      'search_bob',
      'Bob Search'
    );
    const outsider = await register(
      'search.outsider@knowme.test',
      'search_outsider',
      'Outsider Search'
    );
    const outsiderPeer = await register(
      'search.outsider.peer@knowme.test',
      'search_outsider_peer',
      'Outsider Peer'
    );

    const shared = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ title: 'Project nebula', memberIds: [bob.body.user.id] })
      .expect(201);

    const visibleMessage = await request(app.getHttpServer())
      .post(`/conversations/${shared.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'nebula visible shared message' })
      .expect(201);

    const hidden = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ title: 'Hidden nebula room', memberIds: [outsiderPeer.body.user.id] })
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

    expect(result.body.kinds).toEqual([
      'MESSAGE',
      'POST',
      'CHALLENGE',
      'CONVERSATION'
    ]);
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

    const messageOnly = await request(app.getHttpServer())
      .get('/search?q=nebula&limit=20&kinds=MESSAGE')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(messageOnly.body.kinds).toEqual(['MESSAGE']);
    expect(messageOnly.body.items).toHaveLength(1);
    expect(messageOnly.body.items[0]).toMatchObject({
      kind: 'MESSAGE',
      id: visibleMessage.body.id
    });

    await request(app.getHttpServer())
      .get('/search?q=nebula&kinds=PROFILE')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(400);

    const firstPage = await request(app.getHttpServer())
      .get('/search?q=nebula&limit=1')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get(`/search?q=nebula&limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
    expect(new Set([firstPage.body.items[0].id, secondPage.body.items[0].id])).toEqual(
      new Set([shared.body.id, visibleMessage.body.id])
    );

    await request(app.getHttpServer())
      .get(`/search?q=different&limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get(`/search?q=nebula&limit=1&kinds=MESSAGE&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(400);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/search?q=nebula').expect(401);
  });
});
