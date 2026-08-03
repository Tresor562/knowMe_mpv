import { Controller, Get } from '@nestjs/common';
import { messengerExperiencePolicy } from './messenger-experience.domain';

@Controller('messenger-experience')
export class MessengerExperienceController {
  @Get('policy')
  policy() {
    return messengerExperiencePolicy();
  }
}
