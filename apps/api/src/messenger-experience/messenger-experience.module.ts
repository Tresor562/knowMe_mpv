import { Module } from '@nestjs/common';
import { MessengerExperienceController } from './messenger-experience.controller';

@Module({ controllers: [MessengerExperienceController] })
export class MessengerExperienceModule {}
