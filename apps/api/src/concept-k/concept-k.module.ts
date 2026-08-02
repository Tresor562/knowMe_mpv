import { Module } from '@nestjs/common';
import {
  AdminConceptKAssetsController,
  ConceptKAssetsController
} from './concept-k-assets.controller';
import { ConceptKAssetsService } from './concept-k-assets.service';
import { ConceptKController } from './concept-k.controller';
import { ConceptKService } from './concept-k.service';

@Module({
  controllers: [
    ConceptKController,
    ConceptKAssetsController,
    AdminConceptKAssetsController
  ],
  providers: [ConceptKService, ConceptKAssetsService],
  exports: [ConceptKService, ConceptKAssetsService]
})
export class ConceptKModule {}
