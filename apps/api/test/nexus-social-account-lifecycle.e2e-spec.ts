import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Nexus Social account privacy lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.nexusSocialReply.deleteMany();
    await prisma.nexusSocialConversation.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.conversation.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@nexus-lifecycle.knowme.test`,
        username: `nexus_lifecycle_${index}`,
        displayName: `Nexus Lifecycle ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('exports Nexus Social data and purges it when the account is deleted', async () => {
    const owner = await register('owner');
    const peer = await register('peer');
    const ownerId = owner.body.user.id as string;
    const peerId = peer.body.user.id as string;

    const privateConversation = await prisma.conversation.create({
      data: {
        title: 'Nexus',
        isGroup: false,
        members: { create: [{ userId: ownerId }] }
      }
    });
    await prisma.nexusSocialConversation.create({
      data: {
        conversationId: privateConversation.id,
        ownerUserId: ownerId
      }
    });
    const privateSource = await prisma.message.create({
      data: {
        conversationId: privateConversation.id,
        senderId: ownerId,
        content: 'Question privée Nexus'
      }
    });
    await prisma.nexusSocialReply.create({
      data: {
        requestId: 'req-private-lifecycle-0001',
        idempotencyKey: 'idem-private-lifecycle-0001',
        conversationId: privateConversation.id,
        invokingUserId: ownerId,
        sourceMessageId: privateSource.id,
        surface: 'private',
        invocationKind: 'private_message',
        content: 'Réponse privée Nexus'
      }
    });

    const sharedConversation = await prisma.conversation.create({
      data: {
        title: 'Groupe lifecycle',
        isGroup: true,
        members: { create: [{ userId: ownerId }, { userId: peerId }] }
      }
    });
    const sharedSource = await prisma.message.create({
      data: {
        conversationId: sharedConversation.id,
        senderId: ownerId,
        content: '@Nexus réponds dans le groupe'
      }
    });
    await prisma.nexusSocialReply.create({
      data: {
        requestId: 'req-group-lifecycle-0001',
        idempotencyKey: 'idem-group-lifecycle-0001',
        conversationId: sharedConversation.id,
        invokingUserId: ownerId,
        sourceMessageId: sharedSource.id,
        surface: 'group',
        invocationKind: 'mention',
        content: 'Réponse groupe Nexus'
      }
    });

    const exported = await request(app.getHttpServer())
      .get('/account/export')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .expect(200);

    expect(exported.body.nexusSocial.privateConversation.conversationId)
      .toBe(privateConversation.id);
    expect(exported.body.nexusSocial.invokedReplies).toHaveLength(2);
    expect(exported.body.nexusSocial.invokedReplies.map((reply: { content: string }) => reply.content))
      .toEqual(expect.arrayContaining(['Réponse privée Nexus', 'Réponse groupe Nexus']));

    await request(app.getHttpServer())
      .delete('/account')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ password: 'KnowMeTest123!' })
      .expect(200);

    expect(await prisma.user.count({ where: { id: ownerId } })).toBe(0);
    expect(await prisma.nexusSocialReply.count({ where: { invokingUserId: ownerId } })).toBe(0);
    expect(await prisma.nexusSocialConversation.count({ where: { ownerUserId: ownerId } })).toBe(0);
    expect(await prisma.conversation.count({ where: { id: privateConversation.id } })).toBe(0);
    expect(await prisma.conversation.count({ where: { id: sharedConversation.id } })).toBe(1);
    expect(await prisma.user.count({ where: { id: peerId } })).toBe(1);
  });
});
