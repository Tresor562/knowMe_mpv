import { Module } from '@nestjs/common';
import { CosmeticsModule } from '../cosmetics/cosmetics.module';
import { AvatarStudioController } from './avatar-studio.controller';
import { AvatarStudioService } from './avatar-studio.service';

@Module({
  imports: [CosmeticsModule],
  controllers: [AvatarStudioController],
  providers: [AvatarStudioService],
  exports: [AvatarStudioService]
})
export class AvatarStudioModule {}
