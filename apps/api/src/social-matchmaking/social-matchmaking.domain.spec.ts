import {
  availabilityOverlapMinutes,
  compareSocialCriteria,
  normalizeSocialCriteria,
  socialCriteriaHash
} from './social-matchmaking.domain';

describe('Voluntary social matchmaking domain', () => {
  const first = normalizeSocialCriteria({
    purpose: 'LEARN',
    pace: 'FLEXIBLE',
    languages: ['fr', 'en'],
    topics: ['TECH', 'SCIENCE', 'BOOKS'],
    availability: [
      { dayOfWeek: 1, startMinute: 900, endMinute: 1020 },
      { dayOfWeek: 5, startMinute: 1080, endMinute: 1200 }
    ]
  });

  it('normalizes only explicit non-sensitive criteria deterministically', () => {
    const reordered = normalizeSocialCriteria({
      purpose: 'learn',
      pace: 'flexible',
      languages: ['EN', 'fr', 'fr'],
      topics: ['BOOKS', 'TECH', 'SCIENCE'],
      availability: [
        { dayOfWeek: 5, startMinute: 1080, endMinute: 1200 },
        { dayOfWeek: 1, startMinute: 900, endMinute: 1020 }
      ]
    });
    expect(reordered).toEqual(first);
    expect(socialCriteriaHash(reordered)).toBe(socialCriteriaHash(first));
    expect(Object.keys(first).sort()).toEqual([
      'availability',
      'languages',
      'pace',
      'purpose',
      'topics'
    ]);
  });

  it('computes overlap and a bounded explainable score', () => {
    const second = normalizeSocialCriteria({
      purpose: 'LEARN',
      pace: 'ASYNC',
      languages: ['fr'],
      topics: ['TECH', 'BOOKS', 'MUSIC'],
      availability: [
        { dayOfWeek: 1, startMinute: 960, endMinute: 1080 },
        { dayOfWeek: 5, startMinute: 1140, endMinute: 1260 }
      ]
    });
    expect(
      availabilityOverlapMinutes(first.availability, second.availability)
    ).toBe(120);
    const result = compareSocialCriteria(first, second);
    expect(result).toEqual(
      expect.objectContaining({
        compatible: true,
        score: expect.any(Number),
        sharedLanguages: ['fr'],
        sharedTopics: ['BOOKS', 'TECH'],
        overlapMinutes: 120
      })
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.explanations).toHaveLength(5);
    expect(JSON.stringify(result)).not.toMatch(
      /affinity|message|location|religion|health|politic|financial/i
    );
  });

  it('rejects incompatible goals, pace, topics, languages and availability', () => {
    const base = {
      purpose: 'LEARN',
      pace: 'ASYNC',
      languages: ['fr'],
      topics: ['TECH'],
      availability: [{ dayOfWeek: 1, startMinute: 900, endMinute: 960 }]
    };
    expect(
      compareSocialCriteria(
        first,
        normalizeSocialCriteria({ ...base, purpose: 'PLAY' })
      ).compatible
    ).toBe(false);
    expect(
      compareSocialCriteria(
        normalizeSocialCriteria({ ...base, pace: 'REALTIME' }),
        normalizeSocialCriteria({ ...base, pace: 'ASYNC' })
      ).compatible
    ).toBe(false);
    expect(
      compareSocialCriteria(
        first,
        normalizeSocialCriteria({ ...base, topics: ['MUSIC'] })
      ).compatible
    ).toBe(false);
    expect(
      compareSocialCriteria(
        first,
        normalizeSocialCriteria({ ...base, languages: ['de'] })
      ).compatible
    ).toBe(false);
    expect(
      compareSocialCriteria(
        first,
        normalizeSocialCriteria({
          ...base,
          availability: [{ dayOfWeek: 2, startMinute: 900, endMinute: 960 }]
        })
      ).compatible
    ).toBe(false);
  });

  it('refuses forbidden topics, invalid languages and overlapping own windows', () => {
    expect(() =>
      normalizeSocialCriteria({
        purpose: 'CHAT',
        pace: 'FLEXIBLE',
        languages: ['fr'],
        topics: ['POLITICAL_OPINIONS'],
        availability: [{ dayOfWeek: 1, startMinute: 900, endMinute: 960 }]
      })
    ).toThrow();
    expect(() =>
      normalizeSocialCriteria({
        purpose: 'CHAT',
        pace: 'FLEXIBLE',
        languages: ['precise-location'],
        topics: ['TECH'],
        availability: [{ dayOfWeek: 1, startMinute: 900, endMinute: 960 }]
      })
    ).toThrow();
    expect(() =>
      normalizeSocialCriteria({
        purpose: 'CHAT',
        pace: 'FLEXIBLE',
        languages: ['fr'],
        topics: ['TECH'],
        availability: [
          { dayOfWeek: 1, startMinute: 900, endMinute: 1020 },
          { dayOfWeek: 1, startMinute: 960, endMinute: 1080 }
        ]
      })
    ).toThrow();
  });
});
