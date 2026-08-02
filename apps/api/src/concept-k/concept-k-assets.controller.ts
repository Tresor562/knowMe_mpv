import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConceptKAssetsService } from './concept-k-assets.service';
import {
  CreateConceptKAssetDto,
  CreateConceptKCharacterDto,
  ResolveConceptKAssetDto,
  UpdateConceptKAssetRolloutDto
} from './dto/concept-k-assets.dto';

@UseGuards(JwtAuthGuard)
@Controller('concept-k')
export class ConceptKAssetsController {
  constructor(private readonly assets: ConceptKAssetsService) {}

  @Get('characters')
  characters() {
    return this.assets.publicCharacters();
  }

  @Post('assets/resolve')
  resolve(
    @Req() req: { user: { userId: string } },
    @Body() dto: ResolveConceptKAssetDto
  ) {
    return this.assets.resolve(req.user.userId, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.CONCEPT_K_MANAGE)
@Controller('admin/concept-k')
export class AdminConceptKAssetsController {
  constructor(private readonly assets: ConceptKAssetsService) {}

  @Get('catalog')
  catalog() {
    return this.assets.adminCatalog();
  }

  @Post('characters')
  createCharacter(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateConceptKCharacterDto
  ) {
    return this.assets.createCharacter(req.user.userId, dto);
  }

  @Post('assets')
  createAsset(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateConceptKAssetDto
  ) {
    return this.assets.createAsset(req.user.userId, dto);
  }

  @Patch('assets/:id/rollout')
  updateRollout(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateConceptKAssetRolloutDto
  ) {
    return this.assets.updateRollout(req.user.userId, id, dto);
  }
}
