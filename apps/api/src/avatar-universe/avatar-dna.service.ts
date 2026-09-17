import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AVATAR_DNA_DEFAULT_KEYS,
  AVATAR_DNA_SCHEMA_VERSION,
  AvatarDNA,
  validateAvatarDNA
} from './avatar-dna.domain';
import { AVATAR_DEFAULT_MORPHOLOGY, AVATAR_DEFAULT_PERSONALITY } from './avatar-universe.domain';

export type UpdateAvatarDnaInput = Omit<AvatarDNA, 'revision'> & { expectedRevision: number };

@Injectable()
export class AvatarDnaService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const profile = await this.prisma.avatarIdentityProfile.findUnique({ where: { userId } });
    if (profile) return this.toDNA(profile);
    return this.createDefault(userId);
  }

  async update(userId: string, input: UpdateAvatarDnaInput) {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new BadRequestException('expectedRevision must be a positive safe integer');
    }
    const validated = this.validate({ ...input, revision: input.expectedRevision });

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.avatarIdentityProfile.findUnique({ where: { userId } });
      if (!current) {
        if (input.expectedRevision !== 1) throw new ConflictException('Avatar DNA revision conflict.');
        const created = await tx.avatarIdentityProfile.create({
          data: this.persistenceData(userId, validated, 2)
        });
        return this.toDNA(created);
      }
      if (current.revision !== input.expectedRevision) {
        throw new ConflictException('Avatar DNA revision conflict. Reload the latest DNA before saving.');
      }
      const nextRevision = current.revision + 1;
      const updated = await tx.avatarIdentityProfile.update({
        where: { userId },
        data: {
          schemaVersion: validated.schemaVersion,
          revision: nextRevision,
          morphology: validated.morphology as unknown as Prisma.InputJsonValue,
          personality: validated.personality as unknown as Prisma.InputJsonValue,
          renderTier: validated.renderTier,
          baseMeshKey: validated.baseMeshKey,
          skeletonKey: validated.skeletonKey,
          facialRigKey: validated.facialRigKey,
          materialProfileKey: validated.materialProfileKey
        }
      });
      return this.toDNA(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async createDefault(userId: string) {
    try {
      const created = await this.prisma.avatarIdentityProfile.create({
        data: this.persistenceData(userId, {
          schemaVersion: AVATAR_DNA_SCHEMA_VERSION,
          revision: 1,
          morphology: AVATAR_DEFAULT_MORPHOLOGY,
          personality: AVATAR_DEFAULT_PERSONALITY,
          renderTier: 'REALTIME_3D_BALANCED',
          ...AVATAR_DNA_DEFAULT_KEYS
        }, 1)
      });
      return this.toDNA(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.avatarIdentityProfile.findUnique({ where: { userId } });
        if (existing) return this.toDNA(existing);
      }
      throw error;
    }
  }

  private validate(value: unknown) {
    try { return validateAvatarDNA(value); }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid Avatar DNA.');
    }
  }

  private persistenceData(userId: string, dna: AvatarDNA, revision: number) {
    return {
      userId,
      schemaVersion: dna.schemaVersion,
      revision,
      morphology: dna.morphology as unknown as Prisma.InputJsonValue,
      personality: dna.personality as unknown as Prisma.InputJsonValue,
      renderTier: dna.renderTier,
      baseMeshKey: dna.baseMeshKey,
      skeletonKey: dna.skeletonKey,
      facialRigKey: dna.facialRigKey,
      materialProfileKey: dna.materialProfileKey
    };
  }

  private toDNA(profile: { schemaVersion: number; revision: number; morphology: unknown; personality: unknown; renderTier: string; baseMeshKey: string; skeletonKey: string; facialRigKey: string; materialProfileKey: string }) {
    return this.validate(profile);
  }
}
