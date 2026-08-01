import { Module } from '@nestjs/common';
import { CompatibilityService } from './compatibility.service';
import { IntelligenceController } from './intelligence.controller';

@Module({
  controllers: [IntelligenceController],
  providers: [CompatibilityService]
})
export class IntelligenceModule {}
