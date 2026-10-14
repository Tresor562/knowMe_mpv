import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LinkTargetsService } from './link-targets.service';

@UseGuards(JwtAuthGuard)
@Controller('link-targets')
export class LinkTargetsController {
  constructor(private readonly targets: LinkTargetsService) {}

  @Get(':kind/:id')
  resolve(
    @Req() req: { user: { userId: string } },
    @Param('kind') kind: string,
    @Param('id') id: string
  ) {
    return this.targets.resolve(req.user.userId, kind, id);
  }
}
