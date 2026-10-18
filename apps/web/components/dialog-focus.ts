/**
 * Keep keyboard focus inside a modal dialog, including when a portal or script
 * moves focus outside it. Normal interior Tab movements stay browser-native.
 */
export function wrappedDialogFocus(
  controlCount: number,
  activeIndex: number,
  reverse: boolean
): number | null {
  if (!Number.isInteger(controlCount) || controlCount < 1) return null;
  if (activeIndex < 0 || activeIndex >= controlCount) return reverse ? controlCount - 1 : 0;
  if (reverse && activeIndex === 0) return controlCount - 1;
  if (!reverse && activeIndex === controlCount - 1) return 0;
  return null;
}
