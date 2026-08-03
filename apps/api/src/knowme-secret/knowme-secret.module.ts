import { Module } from '@nestjs/common';
import { KnowMeSecretController } from './knowme-secret.controller';

@Module({ controllers: [KnowMeSecretController] })
export class KnowMeSecretModule {}
