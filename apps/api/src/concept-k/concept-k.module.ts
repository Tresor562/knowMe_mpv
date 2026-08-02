import { Module } from '@nestjs/common';
import { ConceptKController } from './concept-k.controller';
import { ConceptKService } from './concept-k.service';

@Module({
  controllers: [ConceptKController],
  providers: [ConceptKService],
  exports: [ConceptKService]
})
export class ConceptKModule {}
