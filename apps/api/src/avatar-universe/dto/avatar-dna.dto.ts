import {
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Min
} from 'class-validator';
import {
  AVATAR_RENDER_TIERS,
  AvatarMorphology,
  AvatarPersonalityProfile
} from '../avatar-universe.domain';

/**
 * Transport DTO for Avatar DNA writes.
 *
 * Nested morphology/personality objects are intentionally validated again by
 * validateAvatarDNA in AvatarDnaService. Keeping the domain validator as the
 * final authority prevents transport-layer changes from weakening DNA rules.
 *
 * Runtime identity keys (base mesh, skeleton, facial rig and material profile)
 * are deliberately absent. They are server-owned compatibility/security
 * decisions and must never be selected by an untrusted client payload.
 */
export class UpdateAvatarDnaDto {
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @IsInt()
  @IsIn([1])
  schemaVersion!: 1;

  @IsObject()
  morphology!: AvatarMorphology;

  @IsObject()
  personality!: AvatarPersonalityProfile;

  @IsString()
  @IsIn(AVATAR_RENDER_TIERS)
  renderTier!: (typeof AVATAR_RENDER_TIERS)[number];
}
