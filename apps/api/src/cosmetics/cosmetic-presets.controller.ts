import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CosmeticPresetsService } from './cosmetic-presets.service';
import {
  ActivateCosmeticPresetDto,
  CreateCosmeticPresetDto,
  UpdateCosmeticPresetDto
} from './dto/cosmetic-presets.dto';

@UseGuards(JwtAuthGuard)
@Controller('cosmetics/presets')
export class CosmeticPresetsController {
  constructor(private readonly presets: CosmeticPresetsService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.presets.list(req.user.userId);
  }

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateCosmeticPresetDto
  ) {
    return this.presets.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCosmeticPresetDto
  ) {
    return this.presets.update(req.user.userId, id, dto);
  }

  @Post(':id/default')
  setDefault(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.presets.setDefault(req.user.userId, id);
  }

  @Get(':id/preview')
  preview(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.presets.preview(req.user.userId, id);
  }

  @Post(':id/activate')
  activate(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ActivateCosmeticPresetDto
  ) {
    return this.presets.activate(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.presets.remove(req.user.userId, id);
  }
}
