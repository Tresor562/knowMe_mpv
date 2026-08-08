import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NexusSocialPrivacyService } from '../nexus-social/nexus-social-privacy.service';
import { SensitiveActionGuard } from '../security/sensitive-action.guard';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly nexusSocialPrivacy: NexusSocialPrivacyService
  ) {}

  @Patch('profile')
  updateProfile(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateProfileDto
  ) {
    return this.account.updateProfile(
      req.user.userId,
      dto
    );
  }

  @UseGuards(SensitiveActionGuard)
  @Get('export')
  async exportData(
    @Req() req: { user: { userId: string } }
  ) {
    const [accountExport, nexusSocial] = await Promise.all([
      this.account.exportData(req.user.userId),
      this.nexusSocialPrivacy.exportForAccount(req.user.userId)
    ]);
    return { ...accountExport, nexusSocial };
  }

  @UseGuards(SensitiveActionGuard)
  @Delete()
  async deleteAccount(
    @Req() req: { user: { userId: string } },
    @Body() dto: DeleteAccountDto
  ) {
    const result = await this.account.deleteAccount(
      req.user.userId,
      dto
    );
    await this.nexusSocialPrivacy.purgeForDeletedAccount(req.user.userId);
    return result;
  }
}
