import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import {
  AVATAR_ALL_SLOTS,
  AvatarAcquisitionMode
} from '../../avatar-universe/avatar-universe.domain';

/** Avatar slots have one canonical source: Avatar Universe. */
export const AVATAR_LAYER_SLOTS = AVATAR_ALL_SLOTS;
export const AVATAR_ACQUISITION_MODES = [
  'FREE',
  'KNOWCOINS',
  'PREMIUM_KNOWCOINS',
  'ACHIEVEMENT',
  'EVENT',
  'CREATOR_DROP'
] as const satisfies readonly AvatarAcquisitionMode[];

export const COSMETIC_SLOTS = [
  ...AVATAR_LAYER_SLOTS,
  'PROFILE_BACKGROUND',
  'CHAT_BUBBLE',
  'PROFILE_BADGE'
] as const;
export const COSMETIC_RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;
export const COSMETIC_GRANT_SOURCES = ['ADMIN', 'ACHIEVEMENT', 'QUEST', 'EVENT', 'MIGRATION'] as const;

export class CreateCosmeticItemDto {
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{2,63}$/) key!: string;
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsString() @IsIn(COSMETIC_SLOTS) slot!: (typeof COSMETIC_SLOTS)[number];
  @IsString() @IsIn(COSMETIC_RARITIES) rarity!: (typeof COSMETIC_RARITIES)[number];
  @IsString() @IsIn(AVATAR_ACQUISITION_MODES) acquisitionMode!: AvatarAcquisitionMode;
  @IsString() @MinLength(1) @MaxLength(500) assetUrl!: string;
  /** Untrusted transport data. CosmeticsService validates the complete manifest before persistence/activation. */
  @IsOptional() @IsObject() avatarAssetManifest?: Record<string, unknown>;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) previewUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsString() @MinLength(5) @MaxLength(240) reason!: string;
}

export class GrantCosmeticItemDto {
  @IsString() @MinLength(1) userId!: string;
  @IsString() @MinLength(1) itemId!: string;
  @IsString() @IsIn(COSMETIC_GRANT_SOURCES) source!: (typeof COSMETIC_GRANT_SOURCES)[number];
  @IsOptional() @IsString() @MaxLength(160) externalReference?: string;
  @IsString() @MinLength(5) @MaxLength(240) reason!: string;
}

export class RevokeCosmeticOwnershipDto {
  @IsString() @MinLength(5) @MaxLength(240) reason!: string;
}

export class EquipCosmeticDto {
  @IsOptional() @IsString() @MinLength(1) itemId?: string | null;
}
