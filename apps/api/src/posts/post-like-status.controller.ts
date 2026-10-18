import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Authoritative per-account like state for a bounded feed page.
 * This lets Web/Android restore the red filled heart after a reload or login,
 * rather than guessing from the public aggregate count.
 */
@Controller('post-like-status')
@UseGuards(JwtAuthGuard)
export class PostLikeStatusController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async readMine(
    @Req() req: { user: { userId: string } },
    @Query('ids') ids: unknown
  ): Promise<Record<string, boolean>> {
    if (typeof ids !== 'string') {
      throw new BadRequestException('Indique les identifiants des publications.');
    }
    const raw = ids.split(',');
    if (raw.length < 1 || raw.length > 50 ||
      raw.some(id => !/^[a-zA-Z0-9_-]{1,120}$/.test(id))) {
      throw new BadRequestException('Indique entre 1 et 50 publications valides.');
    }
    const postIds = [...new Set(raw)];
    const rows = await this.prisma.postLike.findMany({
      where: { userId: req.user.userId, postId: { in: postIds } },
      select: { postId: true }
    });
    const mine = new Set(rows.map(row => row.postId));
    return Object.fromEntries(postIds.map(id => [id, mine.has(id)]));
  }
}
