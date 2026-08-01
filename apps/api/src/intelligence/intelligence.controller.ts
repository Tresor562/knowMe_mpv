import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompatibilityService } from './compatibility.service';
import { SetInterestsDto } from './dto/set-interests.dto';

@UseGuards(JwtAuthGuard)
@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly compatibility: CompatibilityService) {}

  @Put('interests')
  setInterests(
    @Req() req: { user: { userId: string } },
    @Body() dto: SetInterestsDto
  ) {
    return this.compatibility.setInterests(
      req.user.userId,
      dto.interests
    );
  }

  @Get('interests')
  getInterests(@Req() req: { user: { userId: string } }) {
    return this.compatibility.getInterests(req.user.userId);
  }

  @Get('compatibility/:userId')
  calculate(
    @Req() req: { user: { userId: string } },
    @Param('userId') userId: string
  ) {
    return this.compatibility.calculate(req.user.userId, userId);
  }

  @Get('recommendations')
  recommendations(@Req() req: { user: { userId: string } }) {
    return this.compatibility.recommendations(req.user.userId);
  }

  @Get('suggested-challenges')
  suggestedChallenges(@Req() req: { user: { userId: string } }) {
    return this.compatibility.suggestedChallenges(req.user.userId);
  }
}
