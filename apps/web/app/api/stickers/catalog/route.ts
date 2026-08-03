import { NextResponse } from 'next/server';
import { activeStickerPacks } from '../../../../lib/sticker-catalog';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    schemaVersion: 1,
    packs: activeStickerPacks(),
    policy: {
      freeStarterLibrary: true,
      signedMessagesRequired: true,
      arbitraryAssetsAllowed: false,
      arbitraryHtmlAllowed: false,
      visualOnly: true,
      gameplayEffectsAllowed: false,
      resaleAllowed: false,
      transferAllowed: false
    }
  });
}
