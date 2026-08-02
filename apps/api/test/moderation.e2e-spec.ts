import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe anti-spam and moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.abuseEvent.deleteMany();
    await prisma.moderationAction.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks duplicate posts and an active content lock without storing raw content', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'moderation@knowme.test',
        username: 'moderation_member',
        displayName: 'Moderation Member',
        password: 'KnowMeTest123!'
      })
      .expect(201);

    const token = registration.body.accessToken as string;
    const userId = registration.body.user.id as string;
    const content = 'Publication anti-spam unique et sensible';

    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content })
      .expect(201);

    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: `  ${content.toUpperCase()}  ` })
      .expect(429);

    const duplicateEvents = await prisma.abuseEvent.findMany({
      where: { actorId: userId, action: 'POST_CREATE' },
      orderBy: { createdAt: 'asc' }
    });
    expect(duplicateEvents.map((event) => event.decision)).toEqual([
      'ALLOWED',
      'BLOCKED'
    ]);
    expect(duplicateEvents[1]?.reasonCode).toBe('DUPLICATE_CONTENT');
    expect(JSON.stringify(duplicateEvents)).not.toContain(content);

    await prisma.moderationAction.create({
      data: {
        actorId: 'moderator_e2e',
        targetType: 'USER',
        targetId: userId,
        action: 'CONTENT_LOCK',
        reason: 'Validation E2E du verrouillage de contenu'
      }
    });

    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Une autre publication pourtant distincte' })
      .expect(403);

    expect(await prisma.post.count({ where: { authorId: userId } })).toBe(1);
    expect(
      await prisma.abuseEvent.count({
        where: {
          actorId: userId,
          decision: 'BLOCKED',
          reasonCode: 'CONTENT_LOCK'
        }
      })
    ).toBe(1);
  });
});
