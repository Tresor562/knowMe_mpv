export type MobileGuestEntryState = {
  ageGateState: 'ADULT' | 'MINOR_ALLOWED' | null;
  temporaryConfirmed: boolean;
};

export function canCreateMobileGuest(state: MobileGuestEntryState) {
  return Boolean(state.ageGateState && state.temporaryConfirmed);
}

export function parseQuickMathAnswer(raw: string) {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function shouldRecoverAuthoritativeState(previousSequence: number, recoveredSequence: number) {
  return Number.isInteger(previousSequence)
    && Number.isInteger(recoveredSequence)
    && recoveredSequence > previousSequence;
}
