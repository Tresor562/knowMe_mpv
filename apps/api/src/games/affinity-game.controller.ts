import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { UpdateAffinityPreferenceDto } from './dto/update-affinity-preference.dto';

@UseGuards(JwtAuthGuard)
@Controller('games/affinity')
export class AffinityGameController {
  constructor(private readonly policy: AffinityGamePolicyService) {}

  @Get('preferences')
  preferences(@Req() req: { user: { userId: string } }) {
    return this.policy.get(req.user.userId);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateAffinityPreferenceDto
  ) {
    return this.policy.update(req.user.userId, dto);
  }
}
