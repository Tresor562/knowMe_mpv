import type { Metadata } from 'next';
import { KnowMeIconLaboratory } from '../../../components/knowme-icon-laboratory';

export const metadata: Metadata = {
  title: 'KnowMe — Iconography QA',
  robots: { index: false, follow: false }
};

/** Publicly inspectable, unlinked design QA surface. It has no account, purchase
 * or production network actions and must never be mistaken for a real feature.
 */
export default function KnowMeIconographyPreviewPage() {
  return <KnowMeIconLaboratory />;
}
