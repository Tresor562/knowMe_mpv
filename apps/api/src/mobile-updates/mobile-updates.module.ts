import { Module } from '@nestjs/common';
import { MobileUpdatesController } from './mobile-updates.controller';

@Module({ controllers: [MobileUpdatesController] })
export class MobileUpdatesModule {}
