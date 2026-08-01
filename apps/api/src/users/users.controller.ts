import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { staffAccountSelect, toStaffBadge } from '../staff/staff-profile';
import { toVerifiedBadge } from '../verification/verification-profile';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: { user: { userId: string } }) {
    const [user, verifiedIdentity] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          knowCoins: true,
          role: true,
          createdAt: true,
          staffAccount: { select: staffAccountSelect },
          knowCoinWallet: { select: { balance: true } }
        }
      }),
      this.prisma.verifiedIdentity.findUnique({
        where: { userId: req.user.userId }
      })
    ]);

    if (!user) return null;

    const { staffAccount, knowCoinWallet, ...profile } = user;
    return {
      ...profile,
      knowCoins: knowCoinWallet?.balance ?? user.knowCoins,
      accountId: user.id,
      staff: toStaffBadge(staffAccount),
      verified: toVerifiedBadge(verifiedIdentity)
    };
  }
}
