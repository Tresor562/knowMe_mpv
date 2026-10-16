import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The owner explicitly approved these four Gmail addresses. No e-mail addresses
// are returned to the client and no Gmail account outside this exact allowlist
// is eligible. This is presentation-only, not a grant of account privileges.
const APPROVED_EMAIL_DIGESTS = new Set([
  '1f9fc26673a75a83e1346c1f66576230534353546fbe3c7940da204bfc9a5d1d',
  'b209fcb81b184da7d76d5fd8e864052cbf22d73ad5a4b6199c792bfe1fbce076',
  'b14e9515ced5acedf338d4e0b21353c2db44448ff26ee3f27f63cbb2eb17d4c6',
  '3109cc2f1ac2ea5096303fc2969e52fbeeeb24af7d208ade31441d286c8fb364'
]);

function eligible(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith('@gmail.com')) return false;
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return APPROVED_EMAIL_DIGESTS.has(digest);
}

const responseHeaders = { 'Cache-Control': 'no-store, private', 'Vary': 'Authorization' };

export async function GET(request: NextRequest) {
  const bearer = request.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ') || bearer.length > 4096 || bearer.length < 24) {
    return NextResponse.json({ staff: null }, { status: 401, headers: responseHeaders });
  }

  // We do NOT trust the request-supplied username or e-mail. The KnowMe API
  // validates the same bearer token and supplies the registered account e-mail.
  const raw = process.env.KNOWME_API_ORIGIN || process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return NextResponse.json({ staff: null }, { status: 503, headers: responseHeaders });
  let endpoint: URL;
  try {
    endpoint = new URL(raw);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
        endpoint.search || endpoint.hash) throw new Error('Invalid internal KnowMe API origin');
  } catch {
    return NextResponse.json({ staff: null }, { status: 503, headers: responseHeaders });
  }

  try {
    const upstream = await fetch(endpoint.origin + endpoint.pathname.replace(/\/$/, '') + '/users/me', {
      headers: { Authorization: bearer, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      return NextResponse.json({ staff: null }, { status: upstream.status === 401 ? 401 : 503, headers: responseHeaders });
    }
    const account = await upstream.json() as { id?: unknown; username?: unknown; email?: unknown };
    if (typeof account.id !== 'string' || typeof account.username !== 'string' || !eligible(account.email)) {
      return NextResponse.json({ staff: null }, { headers: responseHeaders });
    }
    return NextResponse.json({
      staff: {
        isTeamMember: true,
        label: 'Équipe KnowMe',
        shield: 'GOLD',
        role: 'OWNER'
      }
    }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ staff: null }, { status: 503, headers: responseHeaders });
  }
}
