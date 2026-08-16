import { Module } from '@nestjs/common';
import { ShortLinksController } from './short-links.controller';
import { ShortLinksService } from './short-links.service';

@Module({
  controllers: [ShortLinksController],
  providers: [ShortLinksService],
  exports: [ShortLinksService]
})
export class ShortLinksModule {}
