import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import {UniversalDiscoveryService} from './universal-discovery.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService,UniversalDiscoveryService],
  exports: [SearchService]
})
export class SearchModule {}
