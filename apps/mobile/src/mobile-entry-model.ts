export type MobileEntryMode = 'choice' | 'account' | 'guest';

export function resolveInitialMobileEntry(hasAccountSession: boolean): MobileEntryMode {
  return hasAccountSession ? 'account' : 'choice';
}

export function selectMobileEntry(
  current: MobileEntryMode,
  selection: 'account' | 'guest' | 'choice'
): MobileEntryMode {
  if (current === 'account' && selection === 'choice') {
    return 'account';
  }
  return selection;
}
