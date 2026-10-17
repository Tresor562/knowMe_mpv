import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MobileUpdateSignalsService } from './mobile-update-signals.service';
import { MobileUpdatesController } from './mobile-updates.controller';
import { ExpoOtaController } from './expo-ota.controller';

@Module({
  imports: [RealtimeModule],
  controllers: [MobileUpdatesController, ExpoOtaController],
  providers: [MobileUpdatesController, MobileUpdateSignalsService]
})
export class MobileUpdatesModule {}
