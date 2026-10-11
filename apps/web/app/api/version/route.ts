import { NextResponse } from 'next/server';
import { KNOWME_EXPERIENCE_REVISION, KNOWME_PRODUCT_VERSION } from '@knowme/link-contract';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    platform: 'web',
    version: KNOWME_PRODUCT_VERSION,
    experienceRevision: KNOWME_EXPERIENCE_REVISION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.KNOWME_RELEASE_COMMIT ?? null
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}
