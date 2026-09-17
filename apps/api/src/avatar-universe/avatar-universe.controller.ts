import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AvatarDnaService } from './avatar-dna.service';
import { UpdateAvatarDnaDto } from './dto/avatar-dna.dto';
import {
  AVATAR_FREE_STARTER_KIT,
  avatarUniversePolicy,
  hasCompleteFreeNormalAvatar
} from './avatar-universe.domain';

@Controller('avatar-universe')
export class AvatarUniverseController {
  constructor(private readonly avatarDna: AvatarDnaService) {}

  @Get('policy')
  policy() {
    return avatarUniversePolicy();
  }

  @Get('starter-kit')
  starterKit() {
    return {
      items: AVATAR_FREE_STARTER_KIT,
      completeNormalAvatar: hasCompleteFreeNormalAvatar(AVATAR_FREE_STARTER_KIT),
      priceKnowCoins: 0
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('dna/me')
  dna(@Req() req: { user: { userId: string } }) {
    return this.avatarDna.me(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('dna/me')
  updateDna(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateAvatarDnaDto
  ) {
    return this.avatarDna.update(req.user.userId, dto);
  }
}
