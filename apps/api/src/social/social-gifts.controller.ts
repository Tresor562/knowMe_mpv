import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SendSocialGiftDto,
  SocialGiftHistoryQueryDto
} from './dto/social-gifts.dto';
import { SocialGiftsService } from './social-gifts.service';

@UseGuards(JwtAuthGuard)
@Controller('social/gifts')
export class SocialGiftsController {
  constructor(private readonly gifts: SocialGiftsService) {}

  @Get('catalog')
  catalog() {
    return this.gifts.catalog();
  }

  @Get('policy')
  policy() {
    return this.gifts.policy();
  }

  @Get('inbox')
  inbox(
    @Req() req: { user: { userId: string } },
    @Query() query: SocialGiftHistoryQueryDto
  ) {
    return this.gifts.inbox(req.user.userId, query.cursor, query.limit);
  }

  @Get('sent')
  sent(
    @Req() req: { user: { userId: string } },
    @Query() query: SocialGiftHistoryQueryDto
  ) {
    return this.gifts.sent(req.user.userId, query.cursor, query.limit);
  }

  @Post()
  send(
    @Req() req: { user: { userId: string } },
    @Body() dto: SendSocialGiftDto,
    @Headers('idempotency-key') idempotencyKey?: string
  ) {
    return this.gifts.send(req.user.userId, dto, idempotencyKey);
  }

  @Patch(':giftId/viewed')
  markViewed(
    @Req() req: { user: { userId: string } },
    @Param('giftId') giftId: string
  ) {
    return this.gifts.markViewed(req.user.userId, giftId);
  }
}
