import { isApprovedOwnerGmail, toStaffBadge } from './staff-profile';

describe('Approved KnowMe Gmail gold badges', () => {
  const official = 'tresorhtn@gmail.com';
  const activeStaff = {
    status: 'ACTIVE',
    staffRole: 'OWNER',
    badgeLabel: 'Équipe KnowMe',
    shieldStyle: 'GOLD'
  };

  it('shows a visual-only gold seal for an approved existing account without staff privileges', () => {
    expect(isApprovedOwnerGmail('  TRESORHTN@gmail.com ')).toBe(true);
    expect(toStaffBadge(null, official)).toEqual({
      isTeamMember: true,
      label: 'Compte certifié KnowMe',
      shield: 'GOLD',
      role: 'CERTIFIED'
    });
  });

  it('does not certify arbitrary Gmail accounts or lookalike domains', () => {
    expect(isApprovedOwnerGmail('random@gmail.com')).toBe(false);
    expect(isApprovedOwnerGmail('tresorhtn@gmail.com.bad.example')).toBe(false);
    expect(toStaffBadge(null, 'random@gmail.com')).toBeNull();
    expect(toStaffBadge(null, 'random@example.com')).toBeNull();
  });

  it('preserves staff records and makes gold exclusive to approved Gmail accounts', () => {
    expect(toStaffBadge(activeStaff, official)).toEqual({
      isTeamMember: true,
      label: 'Équipe KnowMe',
      shield: 'GOLD',
      role: 'OWNER'
    });
    expect(toStaffBadge(activeStaff, 'unapproved@gmail.com')?.shield).toBe('STANDARD');
    expect(toStaffBadge(activeStaff, 'unapproved@example.com')?.shield).toBe('STANDARD');
  });

  it('never bypasses an explicit suspension or revocation', () => {
    for (const status of ['REVOKED', 'SUSPENDED', 'INACTIVE']) {
      expect(toStaffBadge({ ...activeStaff, status }, official)).toBeNull();
    }
  });
});
