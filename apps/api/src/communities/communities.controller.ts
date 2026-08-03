import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  CommunityProgressionMetrics,
  CommunityStoryContext,
  CommunityStoryDuration,
  assertCommunityStoryDurationAllowed,
  calculateCommunityProgression,
  communitiesPolicy
} from './communities.domain';

type StoryValidationDto = {
  duration: CommunityStoryDuration;
  context: CommunityStoryContext;
};

@Controller('communities')
export class CommunitiesController {
  @Get('policy')
  policy() {
    return communitiesPolicy();
  }

  @Post('progression/evaluate')
  progression(@Body() metrics: CommunityProgressionMetrics) {
    return calculateCommunityProgression(metrics);
  }

  @Post('stories/validate-duration')
  validateStoryDuration(@Body() dto: StoryValidationDto) {
    assertCommunityStoryDurationAllowed(dto.duration, dto.context);
    return { allowed: true };
  }
}
