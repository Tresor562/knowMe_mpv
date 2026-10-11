import { Controller, Get, Header } from '@nestjs/common';
import {
  KNOWME_EXPERIENCE_REVISION,
  KNOWME_PRODUCT_VERSION
} from '@knowme/link-contract';

@Controller('platform-sync')
export class PlatformSyncController {
  @Get('version')
  @Header('Cache-Control', 'no-store, max-age=0')
  getVersion() {
    return {
      platform: 'api',
      version: KNOWME_PRODUCT_VERSION,
      experienceRevision: KNOWME_EXPERIENCE_REVISION,
      commit: process.env.KNOWME_RELEASE_COMMIT ?? null
    };
  }
}
