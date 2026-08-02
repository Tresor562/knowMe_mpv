import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { IntegrityController } from './integrity.controller';
import { IntegrityService } from './integrity.service';

@Module({
  imports: [ObservabilityModule],
  controllers: [IntegrityController],
  providers: [IntegrityService],
  exports: [IntegrityService]
})
export class IntegrityModule {}
