import { NextRequest, NextResponse } from 'next/server';
import { resolveStickerMessageToken } from '../../../../lib/sticker-token';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: 'Corps JSON invalide.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  try {
    const resolved = resolveStickerMessageToken(token);
    if (!resolved) {
      return NextResponse.json(
        { message: 'Sticker signé invalide ou inconnu.' },
        { status: 404 }
      );
    }
    return NextResponse.json(resolved, {
      headers: {
        'Cache-Control': 'private, max-age=300'
      }
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Résolution impossible.';
    const configurationError = message.includes('STICKER_TOKEN_SECRET');
    return NextResponse.json(
      { message },
      { status: configurationError ? 503 : 400 }
    );
  }
}
