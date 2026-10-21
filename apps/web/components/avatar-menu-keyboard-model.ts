/** WAI-ARIA-style roving focus in a menu of enabled actions.
 * Index -1 means focus was previously outside the menu.
 */
export type AvatarMenuNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

export function nextAvatarMenuIndex(
  key: AvatarMenuNavigationKey, current: number, length: number
): number {
  if (!Number.isSafeInteger(length) || length <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (current < 0 || current >= length) return key === 'ArrowDown' ? 0 : length - 1;
  return key === 'ArrowDown'
    ? (current + 1) % length
    : (current - 1 + length) % length;
}
