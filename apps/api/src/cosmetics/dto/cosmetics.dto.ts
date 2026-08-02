import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export const COSMETIC_SLOTS = [
  'AVATAR_FRAME',
  'PROFILE_BACKGROUND',
  'CHAT_BUBBLE',
  'PROFILE_BADGE'
] as const;

export const COSMETIC_RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export const COSMETIC_GRANT_SOURCES = [
  'ADMIN',
  'ACHIEVEMENT',
  'QUEST',
  'EVENT',
  'MIGRATION'
] as const;

export class CreateCosmeticItemDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{2,63}$/)
  key!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsString()
  @IsIn(COSMETIC_SLOTS)
  slot!: (typeof COSMETIC_SLOTS)[number];

  @IsString()
  @IsIn(COSMETIC_RARITIES)
  rarity!: (typeof COSMETIC_RARITIES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  assetUrl!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  previewUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(240)
  reason!: string;
}

export class GrantCosmeticItemDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsString()
  @IsIn(COSMETIC_GRANT_SOURCES)
  source!: (typeof COSMETIC_GRANT_SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalReference?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(240)
  reason!: string;
}

export class RevokeCosmeticOwnershipDto {
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  reason!: string;
}

export class EquipCosmeticDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  itemId?: string | null;
}
