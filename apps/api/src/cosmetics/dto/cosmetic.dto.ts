import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min
} from 'class-validator';

export const COSMETIC_TYPES = ['AVATAR_FRAME', 'PROFILE_THEME', 'CHAT_BUBBLE', 'PROFILE_ACCENT'] as const;
export const COSMETIC_SLOTS = ['AVATAR_FRAME', 'PROFILE_THEME', 'CHAT_BUBBLE', 'PROFILE_ACCENT'] as const;
export const COSMETIC_RARITIES = ['STANDARD', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export class CreateCosmeticDefinitionDto {
  @IsString()
  @Length(2, 80)
  key!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  version!: number;

  @IsIn(COSMETIC_TYPES)
  type!: (typeof COSMETIC_TYPES)[number];

  @IsIn(COSMETIC_SLOTS)
  slot!: (typeof COSMETIC_SLOTS)[number];

  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Length(8, 500)
  description!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  assetUrl?: string;

  @IsOptional()
  @IsIn(COSMETIC_RARITIES)
  rarity?: (typeof COSMETIC_RARITIES)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsString()
  @Length(8, 300)
  reason!: string;
}

export class GrantCosmeticDto {
  @IsString()
  userId!: string;

  @IsString()
  definitionId!: string;

  @IsString()
  @Length(2, 80)
  source!: string;

  @IsString()
  @Length(8, 300)
  reason!: string;

  @IsString()
  @Length(8, 180)
  idempotencyKey!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EquipCosmeticDto {
  @IsOptional()
  @IsString()
  grantId?: string | null;
}

export class RevokeCosmeticGrantDto {
  @IsString()
  @Length(8, 300)
  reason!: string;
}
