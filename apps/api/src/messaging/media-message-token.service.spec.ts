import { ConfigService } from '@nestjs/config';
import { MediaMessageTokenService } from './media-message-token.service';

describe('MediaMessageTokenService', () => {
  const config = {
    get: (key: string) =>
      key === 'JWT_SECRET'
        ? 'knowme-test-secret-which-is-long-enough-for-signing'
        : undefined
  } as ConfigService;

  it('creates and resolves a conversation-bound voice message', () => {
    const service = new MediaMessageTokenService(config);
    const token = service.create({
      conversationId: 'conversation_123',
      kind: 'VOICE_NOTE',
      assetId: 'asset_123456',
      mimeType: 'audio/webm',
      durationSeconds: 12.4,
      voicePreset: 'DEEP',
      now: new Date('2026-09-25T12:00:00.000Z')
    });

    expect(service.resolve(token, { conversationId: 'conversation_123' }))
      .toEqual({
        kind: 'VOICE_NOTE',
        assetId: 'asset_123456',
        mimeType: 'audio/webm',
        durationSeconds: 12.4,
        voicePreset: 'DEEP',
        transformedVoice: true,
        mediaAccess: 'AUTHENTICATED_CONVERSATION'
      });
    expect(service.resolve(token, { conversationId: 'conversation_other' }))
      .toBeNull();
  });

  it('does not mark an original voice as transformed', () => {
    const service = new MediaMessageTokenService(config);
    const token = service.create({
      conversationId: 'conversation_123',
      kind: 'VOICE_NOTE',
      assetId: 'asset_123456',
      mimeType: 'audio/mp4',
      durationSeconds: 4,
      voicePreset: 'ORIGINAL'
    });

    expect(service.resolve(token, { conversationId: 'conversation_123' }))
      .toMatchObject({
        kind: 'VOICE_NOTE',
        voicePreset: 'ORIGINAL',
        transformedVoice: false
      });
  });

  it('rejects modified tokens', () => {
    const service = new MediaMessageTokenService(config);
    const token = service.create({
      conversationId: 'conversation_123',
      kind: 'VIDEO_NOTE',
      assetId: 'asset_123456',
      mimeType: 'video/webm',
      durationSeconds: 20
    });

    expect(
      service.resolve(`${token.slice(0, -2)}xx`, {
        conversationId: 'conversation_123'
      })
    ).toBeNull();
  });
});
