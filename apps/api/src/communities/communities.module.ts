import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';

@Module({ controllers: [CommunitiesController] })
export class CommunitiesModule {}
