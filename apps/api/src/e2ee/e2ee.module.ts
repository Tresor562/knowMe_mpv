import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { E2eeController } from './e2ee.controller';
import { E2eePrivateMaterialGuard } from './e2ee-private-material.guard';
import { E2eeService } from './e2ee.service';
import { SecretChatController } from './secret-chat.controller';
import { SecretChatService } from './secret-chat.service';

@Module({
  imports: [RealtimeModule],
  controllers: [E2eeController, SecretChatController],
  providers: [E2eeService, SecretChatService, E2eePrivateMaterialGuard],
  exports: [E2eeService, SecretChatService]
})
export class E2eeModule {}
