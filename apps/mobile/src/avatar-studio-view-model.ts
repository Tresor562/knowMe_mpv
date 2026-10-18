/** A failed first load must never display an infinite spinner. */
export function avatarStudioPhase(loading: boolean, hasStudio: boolean):
  'loading' | 'ready' | 'error' {
  if (hasStudio) return 'ready';
  return loading ? 'loading' : 'error';
}
