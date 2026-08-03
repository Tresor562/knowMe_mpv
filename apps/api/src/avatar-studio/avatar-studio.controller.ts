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
import { EquipCosmeticDto } from '../cosmetics/dto/cosmetics.dto';
import { AvatarStudioService } from './avatar-studio.service';

@UseGuards(JwtAuthGuard)
@Controller('avatar-studio')
export class AvatarStudioController {
  constructor(private readonly studio: AvatarStudioService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.studio.me(req.user.userId);
  }

  @Put('equipment/:slot')
  equip(
    @Req() req: { user: { userId: string } },
    @Param('slot') slot: string,
    @Body() dto: EquipCosmeticDto
  ) {
    return this.studio.equip(req.user.userId, slot, dto);
  }

  @Get('public/:username')
  publicSnapshot(
    @Req() req: { user: { userId: string } },
    @Param('username') username: string
  ) {
    return this.studio.publicSnapshot(req.user.userId, username);
  }
}
