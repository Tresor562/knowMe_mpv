import { Module } from '@nestjs/common';
import { AvatarUniverseController } from './avatar-universe.controller';
import { AvatarDnaService } from './avatar-dna.service';

@Module({
  controllers: [AvatarUniverseController],
  providers: [AvatarDnaService],
  exports: [AvatarDnaService]
})
export class AvatarUniverseModule {}
