import {
  createLeaseToken,
  leaseIsExpired,
  nextLeaseExpiry
} from './profile-circle-notification-lease.domain';
import {
  groupProfileCircleDigestItems,
  localWeekdayAndMinute
} from './profile-circle-weekly-digest.service';

describe('profile circle notification orchestration', () => {
  describe('scheduler leases', () => {
    it('creates owner-bound unique tokens', () => {
      const first = createLeaseToken('node-a');
      const second = createLeaseToken('node-a');
      expect(first).toMatch(/^node-a:/);
      expect(second).toMatch(/^node-a:/);
      expect(first).not.toBe(second);
    });

    it('bounds lease duration and detects expiration', () => {
      const now = new Date('2026-08-03T20:00:00.000Z');
      expect(nextLeaseExpiry(now, 1).getTime() - now.getTime()).toBe(15_000);
      expect(nextLeaseExpiry(now, 60 * 60_000).getTime() - now.getTime()).toBe(
        30 * 60_000
      );
      expect(leaseIsExpired({ expiresAt: new Date(now.getTime() - 1) }, now)).toBe(
        true
      );
      expect(leaseIsExpired({ expiresAt: new Date(now.getTime() + 1) }, now)).toBe(
        false
      );
    });
  });

  describe('digest grouping', () => {
    const items = [
      {
        title: 'B',
        body: 'Deuxième',
        occurredAt: new Date('2026-08-03T10:00:00.000Z'),
        circleName: 'Famille',
        type: 'STORY'
      },
      {
        title: 'A',
        body: 'Premier',
        occurredAt: new Date('2026-08-03T12:00:00.000Z'),
        circleName: 'Amis',
        type: 'POST'
      },
      {
        title: 'C',
        body: 'Troisième',
        occurredAt: new Date('2026-08-03T11:00:00.000Z'),
        circleName: 'Amis',
        type: 'STORY'
      }
    ];

    it('orders chronologically without mutating the source', () => {
      const grouped = groupProfileCircleDigestItems(items, 'CHRONOLOGICAL');
      expect(grouped.map((item) => item.title)).toEqual(['A', 'C', 'B']);
      expect(items.map((item) => item.title)).toEqual(['B', 'A', 'C']);
    });

    it('groups by circle then keeps newest items first', () => {
      const grouped = groupProfileCircleDigestItems(items, 'BY_CIRCLE');
      expect(grouped.map((item) => item.title)).toEqual(['A', 'C', 'B']);
    });

    it('groups by notification type', () => {
      const grouped = groupProfileCircleDigestItems(items, 'BY_TYPE');
      expect(grouped.map((item) => item.title)).toEqual(['A', 'C', 'B']);
    });
  });

  it('resolves local weekday and minute through an IANA timezone', () => {
    const local = localWeekdayAndMinute(
      new Date('2026-08-03T20:30:00.000Z'),
      'Africa/Porto-Novo'
    );
    expect(local.weekday).toBe(1);
    expect(local.minuteOfDay).toBe(21 * 60 + 30);
  });
});
