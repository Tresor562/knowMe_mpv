import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConceptKService } from './concept-k.service';
import {
  RecordAnimationTelemetryDto,
  ResolveAnimationDto,
  UpdateAnimationPreferenceDto
} from './dto/concept-k.dto';

@UseGuards(JwtAuthGuard)
@Controller('concept-k')
export class ConceptKController {
  constructor(private readonly conceptK: ConceptKService) {}

  @Get('catalog')
  catalog() {
    return this.conceptK.catalog();
  }

  @Get('preferences')
  preference(@Req() req: { user: { userId: string } }) {
    return this.conceptK.preference(req.user.userId);
  }

  @Patch('preferences')
  updatePreference(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateAnimationPreferenceDto
  ) {
    return this.conceptK.updatePreference(req.user.userId, dto);
  }

  @Post('resolve')
  resolve(
    @Req() req: { user: { userId: string } },
    @Body() dto: ResolveAnimationDto
  ) {
    return this.conceptK.resolve(req.user.userId, dto);
  }

  @Post('telemetry')
  telemetry(
    @Req() req: { user: { userId: string } },
    @Body() dto: RecordAnimationTelemetryDto
  ) {
    return this.conceptK.recordTelemetry(req.user.userId, dto);
  }
}
