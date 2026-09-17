import {
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Min
} from 'class-validator';
import {
  AVATAR_RENDER_TIERS,
  AvatarMorphology,
  AvatarPersonalityProfile
} from '../avatar-universe.domain';

const SAFE_ASSET_KEY = /^[a-z0-9][a-z0-9._-]{1,79}$/i;

/**
 * Transport DTO for Avatar DNA writes.
 *
 * Nested morphology/personality objects are intentionally validated again by
 * validateAvatarDNA in AvatarDnaService. Keeping the domain validator as the
 * final authority prevents transport-layer changes from weakening DNA rules.
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

  @IsString()
  @Matches(SAFE_ASSET_KEY)
  baseMeshKey!: string;

  @IsString()
  @Matches(SAFE_ASSET_KEY)
  skeletonKey!: string;

  @IsString()
  @Matches(SAFE_ASSET_KEY)
  facialRigKey!: string;

  @IsString()
  @Matches(SAFE_ASSET_KEY)
  materialProfileKey!: string;
}
