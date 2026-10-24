import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import {UniversalDiscoveryService} from './universal-discovery.service';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService,
    private readonly discovery:UniversalDiscoveryService) {}

  @Get('discover')
  discover(
    @Req() req:{user:{userId:string}},
    @Query('q') query='',
    @Query('limit',new ParseIntPipe({optional:true})) limit?:number,
    @Query('cursor') cursor?:string,
    @Query('kinds') kinds?:string
  ){
    return this.discovery.discover(req.user.userId,query,limit,cursor,kinds);
  }

  @Get()
  search(
    @Req() req: { user: { userId: string } },
    @Query('q') query = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('cursor') cursor?: string,
    @Query('kinds') kinds?: string
  ) {
    return this.searchService.search(req.user.userId, query, limit, cursor, kinds);
  }
}
