import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';

@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Post()
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateChallengeDto) {
    return this.challenges.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.challenges.list(req.user.userId);
  }

  @Get(':id')
  detail(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.challenges.detail(req.user.userId, id);
  }

  @Post(':id/join')
  join(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.challenges.join(req.user.userId, id);
  }

  @Post(':id/answers')
  submitAnswers(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SubmitAnswersDto
  ) {
    return this.challenges.submitAnswers(req.user.userId, id, dto);
  }

  @Patch(':id/complete')
  complete(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.challenges.complete(req.user.userId, id);
  }
}
