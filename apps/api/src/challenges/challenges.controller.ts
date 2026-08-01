import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Post()
  create(@Req() req: { user:{userId:string} }, @Body() dto: CreateChallengeDto) {
    return this.challenges.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: { user:{userId:string} }) {
    return this.challenges.list(req.user.userId);
  }

  @Post(':id/join')
  join(@Req() req: { user:{userId:string} }, @Param('id') id: string) {
    return this.challenges.join(req.user.userId, id);
  }
}
