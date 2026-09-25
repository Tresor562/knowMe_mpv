import { voiceTransformFilter } from './voice-transform.service';

describe('voiceTransformFilter', () => {
  it('keeps generic voice effects bounded to reviewed ffmpeg filters', () => {
    expect(voiceTransformFilter('DEEP')).toContain('atempo=');
    expect(voiceTransformFilter('BRIGHT')).toContain('highshelf=');
    expect(voiceTransformFilter('ROBOT')).toContain('tremolo=');
  });

  it('does not build filters from arbitrary user input', () => {
    const reviewed = [
      voiceTransformFilter('DEEP'),
      voiceTransformFilter('BRIGHT'),
      voiceTransformFilter('ROBOT')
    ];
    for (const filter of reviewed) {
      expect(filter).not.toContain(';');
      expect(filter.length).toBeLessThan(180);
    }
  });
});
