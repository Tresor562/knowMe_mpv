import { detectDominantConversationLanguage } from './conversation-translation.service';

describe('conversation language detection', () => {
  it('detects French conversation text locally', () => {
    expect(
      detectDominantConversationLanguage([
        'Je suis là mais je ne peux pas rester longtemps.',
        'Tu peux venir avec les autres pour la discussion ?'
      ])
    ).toBe('fr');
  });

  it('detects English conversation text locally', () => {
    expect(
      detectDominantConversationLanguage([
        'You can send the message and I will read it.',
        'This is the conversation with the new group.'
      ])
    ).toBe('en');
  });

  it('returns null when the language is not clear enough', () => {
    expect(detectDominantConversationLanguage(['KnowMe 42'])).toBeNull();
  });
});
