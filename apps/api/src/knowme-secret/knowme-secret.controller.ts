import { Controller, Get } from '@nestjs/common';
import { knowMeSecretPolicy } from './knowme-secret.domain';

@Controller('knowme-secret')
export class KnowMeSecretController {
  @Get('policy')
  policy() {
    return knowMeSecretPolicy();
  }
}
