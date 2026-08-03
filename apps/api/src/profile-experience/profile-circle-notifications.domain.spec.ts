import {
  circleNotificationLink,
  normalizeNotificationRecipients,
  validateCircleNotification
} from './profile-circle-notifications.domain';

describe('collective profile notifications', () => {
  it('deduplicates recipients and excludes the actor by default', () => {
    expect(
      normalizeNotificationRecipients({
        recipients: ['alice', 'bob', 'alice', ''],
        actorUserId: 'alice'
      })
    ).toEqual(['bob']);
  });

  it('does not fail when an event has no external recipient', () => {
    expect(
      validateCircleNotification({
        idempotencyKey: 'circle:event:1',
        type: 'CIRCLE_MEMBER_LEFT',
        title: 'Membre parti',
        body: 'Un membre a quitté la structure.',
        recipients: []
      })
    ).toEqual({ deliver: false, reason: 'NO_RECIPIENT' });
  });

  it('rejects unknown notification types', () => {
    expect(() =>
      validateCircleNotification({
        idempotencyKey: 'unknown:1',
        type: 'UNKNOWN_EVENT',
        title: 'Test',
        body: 'Test',
        recipients: ['alice']
      })
    ).toThrow('inconnu');
  });

  it('builds safe internal deep links', () => {
    expect(circleNotificationLink({ circleSlug: 'les otakus' })).toBe(
      '/circles/les%20otakus'
    );
    expect(circleNotificationLink({ management: true })).toBe(
      '/profile-circle-governance'
    );
  });
});
