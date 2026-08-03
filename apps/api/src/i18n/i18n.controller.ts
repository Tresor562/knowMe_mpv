import {
  Body,
  Controller,
  Get,
  Headers,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateLocalePreferenceDto } from './dto/update-locale-preference.dto';
import { I18nService } from './i18n.service';

@Controller('i18n')
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get('catalog')
  catalog() {
    return this.i18n.catalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get('preferences')
  preference(
    @Req() req: { user: { userId: string } },
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.i18n.preference(req.user.userId, acceptLanguage);
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences')
  update(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateLocalePreferenceDto
  ) {
    return this.i18n.update(req.user.userId, dto);
  }
}
