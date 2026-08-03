import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppearanceService } from './appearance.service';
import { UpdateAppearancePreferenceDto } from './dto/appearance.dto';

@UseGuards(JwtAuthGuard)
@Controller('appearance')
export class AppearanceController {
  constructor(private readonly appearance: AppearanceService) {}

  @Get()
  get(@Req() req: { user: { userId: string } }) {
    return this.appearance.getForUser(req.user.userId);
  }

  @Patch()
  update(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateAppearancePreferenceDto
  ) {
    return this.appearance.update(req.user.userId, dto);
  }
}
