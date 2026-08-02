import { Module } from '@nestjs/common';
import {
  AdminConceptKAssetsController,
  ConceptKAssetsController
} from './concept-k-assets.controller';
import { ConceptKAssetsService } from './concept-k-assets.service';
import {
  AdminConceptKDeliveryHealthController,
  ConceptKDeliveryHealthController
} from './concept-k-delivery-health.controller';
import { ConceptKDeliveryHealthService } from './concept-k-delivery-health.service';
import { ConceptKController } from './concept-k.controller';
import { ConceptKService } from './concept-k.service';

@Module({
  controllers: [
    ConceptKController,
    ConceptKAssetsController,
    AdminConceptKAssetsController,
    ConceptKDeliveryHealthController,
    AdminConceptKDeliveryHealthController
  ],
  providers: [
    ConceptKService,
    ConceptKAssetsService,
    ConceptKDeliveryHealthService
  ],
  exports: [
    ConceptKService,
    ConceptKAssetsService,
    ConceptKDeliveryHealthService
  ]
})
export class ConceptKModule {}
