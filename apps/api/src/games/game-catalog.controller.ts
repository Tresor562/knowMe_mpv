import { Controller, Get, Query } from '@nestjs/common';
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
}
