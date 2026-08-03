import { Module } from '@nestjs/common';
import { KnowMeSecretController } from './knowme-secret.controller';
import { KnowMeSecretService } from './knowme-secret.service';

@Module({
  controllers: [KnowMeSecretController],
  providers: [KnowMeSecretService],
  exports: [KnowMeSecretService]
})
export class KnowMeSecretModule {}
