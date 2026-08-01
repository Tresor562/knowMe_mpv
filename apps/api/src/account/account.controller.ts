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
import { SensitiveActionGuard } from '../security/sensitive-action.guard';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

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
  exportData(
    @Req() req: { user: { userId: string } }
  ) {
    return this.account.exportData(
      req.user.userId
    );
  }

  @UseGuards(SensitiveActionGuard)
  @Delete()
  deleteAccount(
    @Req() req: { user: { userId: string } },
    @Body() dto: DeleteAccountDto
  ) {
    return this.account.deleteAccount(
      req.user.userId,
      dto
    );
  }
}
