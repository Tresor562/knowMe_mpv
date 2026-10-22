const MAIN_ROUTES = new Set(['/dashboard', '/feed', '/discover', '/notifications', '/messages', '/profile']);
const PUBLIC_ROUTES = /^\/(?:login|register|signup|auth|forgot-password|reset-password|recovery|privacy|terms|legal|download)(?:\/|$)/;

/** Entry points and primary tabs must not have an extra floating back control. */
export function isSecondaryKnowMeRoute(pathname: string) {
  return pathname.startsWith('/') && pathname !== '/' && !MAIN_ROUTES.has(pathname) &&
    !PUBLIC_ROUTES.test(pathname);
}
