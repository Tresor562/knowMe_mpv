import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { knowMeSecretPolicy } from './knowme-secret.domain';
import { knowMeSecretExtendedPolicy } from './knowme-secret-flow.domain';
import {
  CreateSecretCampaignDto,
  SecretReplyDto,
  SubmitSecretMessageDto,
  UpdateSecretPageDto
} from './knowme-secret.dto';
import { KnowMeSecretService } from './knowme-secret.service';

@Controller('knowme-secret')
export class KnowMeSecretController {
  constructor(private readonly secret: KnowMeSecretService) {}

  @Get('policy')
  policy() {
    return {
      ...knowMeSecretPolicy(),
      extended: knowMeSecretExtendedPolicy()
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  mine(@Req() req: { user: { userId: string } }) {
    return this.secret.getMine(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMine(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateSecretPageDto
  ) {
    return this.secret.updateMine(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/campaigns')
  createCampaign(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateSecretCampaignDto
  ) {
    return this.secret.createCampaign(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/campaigns/:id/share')
  shareCampaign(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.secret.recordCampaignShare(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/inbox')
  inbox(
    @Req() req: { user: { userId: string } },
    @Query('limit') limit?: string
  ) {
    return this.secret.inbox(req.user.userId, limit ? Number(limit) : 50);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/inbox/:id/open')
  openMessage(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.secret.openMessage(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/inbox/:id/archive')
  archiveMessage(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.secret.archiveMessage(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/inbox/:id/block-sender')
  blockSender(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.secret.blockSender(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/inbox/:id/reply')
  reply(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SecretReplyDto
  ) {
    return this.secret.reply(req.user.userId, id, dto);
  }

  @Get('public/:slug')
  publicPage(
    @Param('slug') slug: string,
    @Query('question') campaignToken?: string,
    @Query('entry') entryPoint?: string
  ) {
    return this.secret.getPublicPage(slug, campaignToken, entryPoint);
  }

  @Post('public/:slug/messages')
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitSecretMessageDto,
    @Req()
    req: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }
  ) {
    const userAgent = req.headers['user-agent'];
    const acceptLanguage = req.headers['accept-language'];
    return this.secret.submitPublicMessage(slug, dto, {
      ip: req.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
      acceptLanguage: Array.isArray(acceptLanguage)
        ? acceptLanguage.join(',')
        : acceptLanguage
    });
  }
}
