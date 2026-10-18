export type Notice<T extends string = string> = { text: string; tone: T };
export type QueuedNotice<T extends string = string> = Notice<T> & { id: number };

/** Keep the visible message stable, deduplicate bursts and bound the backlog. */
export function enqueueNotice<T extends string>(
  current: QueuedNotice<T>[],
  incoming: QueuedNotice<T>,
  limit = 4
): QueuedNotice<T>[] {
  if (current.some(item => item.text === incoming.text && item.tone === incoming.tone)) {
    return current;
  }
  const max = Math.max(1, Math.trunc(limit) || 1);
  if (current.length < max) return [...current, incoming];
  // Preserve the currently visible notice while making room for recent alerts.
  return max === 1 ? [incoming] : [...current.slice(0, max - 1), incoming];
}
