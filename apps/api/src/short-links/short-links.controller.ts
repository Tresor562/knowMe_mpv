import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateShortLinkDto, RevokeShortLinkDto } from './short-links.dto';
import { ShortLinksService } from './short-links.service';

@Controller('short-links')
export class ShortLinksController {
  constructor(private readonly shortLinks: ShortLinksService) {}

  @Get('policy')
  policy() {
    return this.shortLinks.policy();
  }

  @Get('preview/:code')
  preview(@Param('code') code: string) {
    return this.shortLinks.preview(code);
  }

  @Get('resolve/:code')
  resolve(@Param('code') code: string) {
    return this.shortLinks.resolve(code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  mine(@Req() req: { user: { userId: string } }) {
    return this.shortLinks.mine(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateShortLinkDto
  ) {
    return this.shortLinks.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RevokeShortLinkDto
  ) {
    return this.shortLinks.revoke(req.user.userId, id, dto.idempotencyKey);
  }
}
