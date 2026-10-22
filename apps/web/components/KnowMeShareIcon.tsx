/** Approved KnowMe filled, curved share arrow. Single visual source for Web. */
export const KNOWME_SHARE_PATH = 'M14 4.8c0-.4.46-.61.76-.34l6.7 6.18c.72.66.72 1.79 0 2.45l-6.7 6.18c-.3.27-.76.06-.76-.34v-3.97c-2.39.07-4.35.67-5.95 1.85-1.76 1.29-3.1 3.21-4.2 5.91-.15.36-.68.25-.67-.14.06-3.02.62-5.62 1.77-7.77 1.93-3.61 5.08-5.62 9.05-5.85V4.8Z';

export function KnowMeShareIcon({ size = 22, className }: { size?: number; className?: string }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"
    className={className} aria-hidden="true" focusable="false" data-knowme-icon="share">
    <path d={KNOWME_SHARE_PATH} />
  </svg>;
}
