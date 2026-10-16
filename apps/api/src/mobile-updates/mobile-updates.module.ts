import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MobileUpdateSignalsService } from './mobile-update-signals.service';
import { MobileUpdatesController } from './mobile-updates.controller';

@Module({
  imports: [RealtimeModule],
  controllers: [MobileUpdatesController],
  providers: [MobileUpdatesController, MobileUpdateSignalsService]
})
export class MobileUpdatesModule {}
