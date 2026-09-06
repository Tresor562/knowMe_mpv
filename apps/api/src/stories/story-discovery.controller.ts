import { Controller, Get, Query } from '@nestjs/common';
import { StoryDiscoveryService } from './story-discovery.service';

@Controller('stories/discover')
export class StoryDiscoveryController {
  constructor(private readonly discovery: StoryDiscoveryService) {}

  @Get()
  discover(
    @Query('hashtag') hashtag?: string,
    @Query('location') location?: string,
    @Query('cursor') cursor?: string
  ) {
    return this.discovery.discover({ hashtag, location, cursor });
  }

  @Get('trending-hashtags')
  trendingHashtags() {
    return this.discovery.trendingHashtags();
  }
}
