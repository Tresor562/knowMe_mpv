import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AFFINITY_GAME_DEFINITION,
  AffinityMirrorEngine
} from './affinity-mirror.engine';
import {
  BUILTIN_GAME_CATALOG,
  GameEngineAdapter,
  PulseDuelEngine,
  gameDefinitionChecksum
} from './game-platform.domain';

@Injectable()
export class GameEngineRegistry implements OnModuleInit {
  private readonly engines = new Map<string, GameEngineAdapter>();

  constructor(private readonly prisma: PrismaService) {
    const pulseDuel = new PulseDuelEngine();
    const affinityMirror = new AffinityMirrorEngine();
    this.engines.set(pulseDuel.engineKey, pulseDuel);
    this.engines.set(affinityMirror.engineKey, affinityMirror);
  }

  async onModuleInit() {
    await this.syncCatalog();
  }

  async syncCatalog() {
    for (const definition of [...BUILTIN_GAME_CATALOG, AFFINITY_GAME_DEFINITION]) {
      const checksum = gameDefinitionChecksum(definition);
      const existing = await this.prisma.gameDefinition.findUnique({
        where: { key_version: { key: definition.key, version: definition.version } }
      });
      if (existing) {
        if (existing.checksum !== checksum) {
          throw new Error(
            `Immutable game definition changed: ${definition.key}@${definition.version}`
          );
        }
        continue;
      }
      await this.prisma.gameDefinition.create({
        data: {
          key: definition.key,
          version: definition.version,
          name: definition.name,
          description: definition.description,
          engineKey: definition.engineKey,
          minPlayers: definition.minPlayers,
          maxPlayers: definition.maxPlayers,
          status: 'ACTIVE',
          rules: definition.rules as Prisma.InputJsonValue,
          initialConfig: definition.initialConfig as Prisma.InputJsonValue,
          checksum
        }
      });
    }
  }

  listActive() {
    return this.prisma.gameDefinition.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });
  }

  async latestActive(key: string) {
    return this.prisma.gameDefinition.findFirst({
      where: { key, status: 'ACTIVE' },
      orderBy: { version: 'desc' }
    });
  }

  engine(engineKey: string) {
    const engine = this.engines.get(engineKey);
    if (!engine) throw new Error(`Unsupported game engine: ${engineKey}`);
    return engine;
  }
}
