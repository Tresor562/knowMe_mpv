import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConceptKDeliveryHealthService } from './concept-k-delivery-health.service';
import {
  RecordConceptKAssetDeliveryDto,
  RestoreConceptKAssetDto
} from './dto/concept-k-delivery.dto';

@UseGuards(JwtAuthGuard)
@Controller('concept-k/assets')
export class ConceptKDeliveryHealthController {
  constructor(private readonly health: ConceptKDeliveryHealthService) {}

  @Post('delivery')
  record(
    @Req() req: { user: { userId: string } },
    @Body() dto: RecordConceptKAssetDeliveryDto
  ) {
    return this.health.record(req.user.userId, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.CONCEPT_K_MANAGE)
@Controller('admin/concept-k/assets')
export class AdminConceptKDeliveryHealthController {
  constructor(private readonly health: ConceptKDeliveryHealthService) {}

  @Get('health')
  list() {
    return this.health.adminHealth();
  }

  @Patch(':id/restore')
  restore(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RestoreConceptKAssetDto
  ) {
    return this.health.restore(req.user.userId, id, dto);
  }
}
