import { Module } from '@nestjs/common';
import { NexusIntegrationController } from './nexus-integration.controller';
import { NexusIntegrationService } from './nexus-integration.service';

@Module({
  controllers: [NexusIntegrationController],
  providers: [NexusIntegrationService],
  exports: [NexusIntegrationService]
})
export class NexusIntegrationModule {}
