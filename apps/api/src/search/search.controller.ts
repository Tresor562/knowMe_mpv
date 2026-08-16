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

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Req() req: { user: { userId: string } },
    @Query('q') query = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('cursor') cursor?: string
  ) {
    return this.searchService.search(req.user.userId, query, limit, cursor);
  }
}
