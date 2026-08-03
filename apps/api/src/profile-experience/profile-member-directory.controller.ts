import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileMemberDirectoryService } from './profile-member-directory.service';

type AuthRequest = { user: { userId: string } };

@UseGuards(JwtAuthGuard)
@Controller('profile-member-directory')
export class ProfileMemberDirectoryController {
  constructor(private readonly directory: ProfileMemberDirectoryService) {}

  @Get()
  search(
    @Req() req: AuthRequest,
    @Query('q') query = '',
    @Query('circleId') circleId?: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.directory.search({
      viewerUserId: req.user.userId,
      query,
      circleId: circleId?.trim() || null,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined
    });
  }
}
