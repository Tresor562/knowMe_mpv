import { NextRequest, NextResponse } from 'next/server';
import { createStickerMessageToken } from '../../../../lib/sticker-token';

export const dynamic = 'force-dynamic';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: 'Corps JSON invalide.' }, { status: 400 });
  }

  try {
    const token = createStickerMessageToken({
      packKey: text(body.packKey),
      stickerKey: text(body.stickerKey),
      conversationId: text(body.conversationId)
    });
    return NextResponse.json({
      token,
      contentType: 'application/vnd.knowme.sticker+text',
      visualOnly: true,
      clientAssetAccepted: false
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Sticker indisponible.';
    const configurationError = message.includes('STICKER_TOKEN_SECRET');
    return NextResponse.json(
      { message },
      { status: configurationError ? 503 : 400 }
    );
  }
}
