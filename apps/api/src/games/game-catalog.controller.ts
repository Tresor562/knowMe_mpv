import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameCatalogService } from './game-catalog.service';

@Controller('games')
export class GameCatalogController {
  constructor(private readonly catalogService: GameCatalogService) {}

  @Get('center')
  catalog(
    @Query('q') query?: string,
    @Query('category') category?: string
  ) {
    return this.catalogService.catalog(query, category);
  }

  @Get('categories')
  categories() {
    return this.catalogService.categories();
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  favorites(@Req() req: { user: { userId: string } }) {
    return this.catalogService.listFavorites(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':key/favorite')
  favorite(
    @Req() req: { user: { userId: string } },
    @Param('key') key: string
  ) {
    return this.catalogService.addFavorite(req.user.userId, key);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':key/favorite')
  unfavorite(
    @Req() req: { user: { userId: string } },
    @Param('key') key: string
  ) {
    return this.catalogService.removeFavorite(req.user.userId, key);
  }
}
