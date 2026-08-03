import { Module } from '@nestjs/common';
import { AvatarUniverseController } from './avatar-universe.controller';

@Module({
  controllers: [AvatarUniverseController]
})
export class AvatarUniverseModule {}
