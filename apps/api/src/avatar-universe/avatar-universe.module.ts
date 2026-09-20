import { Module } from '@nestjs/common';
import { AvatarUniverseController } from './avatar-universe.controller';
import { AvatarDnaService } from './avatar-dna.service';
import { HeroRuntimeEvidenceAuthority, HeroRuntimeEvidenceStore } from './hero-runtime-evidence-v22.domain';
import { HeroRuntimeEvidencePostgresStore } from './hero-runtime-evidence-v23.store';

export const HERO_RUNTIME_EVIDENCE_STORE = Symbol('HERO_RUNTIME_EVIDENCE_STORE');

@Module({
  controllers: [AvatarUniverseController],
  providers: [
    AvatarDnaService,
    HeroRuntimeEvidencePostgresStore,
    {
      provide: HERO_RUNTIME_EVIDENCE_STORE,
      useExisting: HeroRuntimeEvidencePostgresStore,
    },
    {
      provide: HeroRuntimeEvidenceAuthority,
      inject: [HERO_RUNTIME_EVIDENCE_STORE],
      useFactory: (store: HeroRuntimeEvidenceStore) => new HeroRuntimeEvidenceAuthority(store),
    },
  ],
  exports: [AvatarDnaService, HeroRuntimeEvidenceAuthority, HERO_RUNTIME_EVIDENCE_STORE],
})
export class AvatarUniverseModule {}
