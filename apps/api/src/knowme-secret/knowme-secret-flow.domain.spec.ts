import {
  assertSecretPublicAccess,
  knowMeSecretExtendedPolicy,
  secretScenarioCatalog
} from './knowme-secret-flow.domain';

describe('KnowMe Secret public flow', () => {
  it('allows a shared link only after activation', () => {
    expect(() =>
      assertSecretPublicAccess({
        pageEnabled: true,
        profileEntryEnabled: true,
        entryPoint: 'SHARED_LINK',
        pausedUntil: null
      })
    ).not.toThrow();

    expect(() =>
      assertSecretPublicAccess({
        pageEnabled: false,
        profileEntryEnabled: true,
        entryPoint: 'SHARED_LINK',
        pausedUntil: null
      })
    ).toThrow('ne reçoit pas');
  });

  it('lets the owner hide only the profile CTA without revoking shared links', () => {
    expect(() =>
      assertSecretPublicAccess({
        pageEnabled: true,
        profileEntryEnabled: false,
        entryPoint: 'PUBLIC_PROFILE_CTA',
        pausedUntil: null
      })
    ).toThrow('profil');

    expect(() =>
      assertSecretPublicAccess({
        pageEnabled: true,
        profileEntryEnabled: false,
        entryPoint: 'SHARED_LINK',
        pausedUntil: null
      })
    ).not.toThrow();
  });

  it('rejects paused, expired, closed and saturated campaigns', () => {
    const base = {
      pageEnabled: true,
      profileEntryEnabled: true,
      entryPoint: 'QUESTION_CARD' as const,
      pausedUntil: null
    };

    expect(() =>
      assertSecretPublicAccess({
        ...base,
        campaignStatus: 'CLOSED'
      })
    ).toThrow('plus de réponses');

    expect(() =>
      assertSecretPublicAccess({
        ...base,
        campaignStatus: 'ACTIVE',
        campaignExpiresAt: new Date('2026-08-03T12:00:00.000Z'),
        now: new Date('2026-08-03T13:00:00.000Z')
      })
    ).toThrow('expiré');

    expect(() =>
      assertSecretPublicAccess({
        ...base,
        campaignStatus: 'ACTIVE',
        campaignMaximumMessages: 100,
        campaignMessageCount: 100
      })
    ).toThrow('limite');
  });

  it('keeps anonymity stronger than identity-selling hint systems', () => {
    expect(knowMeSecretExtendedPolicy()).toMatchObject({
      coreFlowMatchesAnonymousQa: {
        activatePersonalLink: true,
        shareLinkOutsideKnowMe: true,
        receiveAnonymousResponsesInInbox: true,
        answerAndReshare: true
      },
      knowMeAdvantages: {
        sendFromEnabledPublicProfile: true,
        questionSpecificCampaigns: true,
        noIdentityRevealForPremium: true
      }
    });
  });

  it('documents broad operational and abuse scenarios', () => {
    const scenarios = secretScenarioCatalog();
    expect(scenarios.length).toBeGreaterThanOrEqual(20);
    expect(scenarios).toEqual(
      expect.arrayContaining([
        'OWNER_ACTIVATES_AND_SHARES_GENERIC_LINK',
        'VISITOR_SENDS_FROM_PUBLIC_PROFILE',
        'BLOCKED_SENDER_TRIES_AGAIN',
        'NO_NETWORK_OR_DUPLICATE_SUBMISSION'
      ])
    );
  });
});
