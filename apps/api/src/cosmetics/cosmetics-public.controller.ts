import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CosmeticsPublicService } from './cosmetics-public.service';

@UseGuards(JwtAuthGuard)
@Controller('cosmetics/public')
export class CosmeticsPublicController {
  constructor(private readonly cosmeticsPublic: CosmeticsPublicService) {}

  @Get(':username')
  snapshot(
    @Req() req: { user: { userId: string } },
    @Param('username') username: string
  ) {
    return this.cosmeticsPublic.snapshot(req.user.userId, username.trim());
  }
}
