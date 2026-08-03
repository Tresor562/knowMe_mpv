import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('KnowMe signed stickers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.STICKER_TOKEN_ACTIVE_KEY_ID = 'e2e';
    process.env.STICKER_TOKEN_ACTIVE_SECRET = 's'.repeat(48);
    process.env.STICKER_TOKEN_TTL_MS = String(24 * 60 * 60_000);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });

  afterAll(async () => {
    delete process.env.STICKER_TOKEN_ACTIVE_KEY_ID;
    delete process.env.STICKER_TOKEN_ACTIVE_SECRET;
    delete process.env.STICKER_TOKEN_TTL_MS;
    await app.close();
  });

  async function register(index: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${index}@stickers.knowme.test`,
        username: `stickers_${index}`,
        displayName: `Stickers ${index}`,
        password: 'KnowMeTest123!'
      })
      .expect(201);
  }

  it('keeps catalog, membership, signatures and conversation binding authoritative', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');

    await request(app.getHttpServer())
      .get('/stickers/catalog')
      .expect(401);

    const catalog = await request(app.getHttpServer())
      .get('/stickers/catalog')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .expect(200);

    expect(catalog.body).toMatchObject({
      schemaVersion: 1,
      visualOnly: true,
      externalAssetAllowed: false,
      arbitraryHtmlAllowed: false,
      clientAssetAccepted: false
    });
    expect(catalog.body.packs).toHaveLength(2);

    const firstConversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ memberIds: [bob.body.user.id] })
      .expect(201);

    const secondConversation = await request(app.getHttpServer())
      .post('/conversations')
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ memberIds: [outsider.body.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${firstConversation.body.id}/stickers`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ packKey: 'knowme-sparks', stickerKey: 'bravo' })
      .expect(403);

    const sent = await request(app.getHttpServer())
      .post(`/conversations/${firstConversation.body.id}/stickers`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ packKey: 'knowme-sparks', stickerKey: 'bravo' })
      .expect(201);

    expect(sent.body.content).toMatch(/^KNOWME_STICKER_V1\./);
    expect(sent.body.presentation).toMatchObject({
      kind: 'STICKER',
      sticker: {
        key: 'bravo',
        label: 'Bravo',
        glyph: '👏✨'
      },
      visualOnly: true,
      externalAssetAllowed: false,
      arbitraryHtmlAllowed: false
    });

    const history = await request(app.getHttpServer())
      .get(`/conversations/${firstConversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);

    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].presentation.kind).toBe('STICKER');
    expect(history.body.items[0].presentation.sticker.key).toBe('bravo');

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .expect(200);
    expect(
      notifications.body.some(
        (item: { type: string; body: string }) =>
          item.type === 'MESSAGE' && item.body === 'Sticker : Bravo'
      )
    ).toBe(true);

    const crossed = await request(app.getHttpServer())
      .post(`/conversations/${secondConversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: sent.body.content })
      .expect(201);
    expect(crossed.body.presentation).toEqual({
      kind: 'TEXT',
      text: sent.body.content
    });

    const token = sent.body.content as string;
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    const falsified = await request(app.getHttpServer())
      .post(`/conversations/${firstConversation.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.body.accessToken}`)
      .send({ content: tampered })
      .expect(201);
    expect(falsified.body.presentation).toEqual({
      kind: 'TEXT',
      text: tampered
    });

    const text = await request(app.getHttpServer())
      .post(`/conversations/${firstConversation.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.body.accessToken}`)
      .send({ content: 'Message texte normal.' })
      .expect(201);
    expect(text.body.presentation).toEqual({
      kind: 'TEXT',
      text: 'Message texte normal.'
    });
  });
});
