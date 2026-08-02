import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class CreateConceptKCharacterDto {
  @IsString()
  @Matches(KEY_PATTERN)
  key!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  version!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description!: string;

  @IsBoolean()
  active!: boolean;

  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason!: string;
}

export class CreateConceptKAssetDto {
  @IsString()
  @Matches(KEY_PATTERN)
  key!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  version!: number;

  @IsString()
  @MaxLength(80)
  eventKey!: string;

  @IsString()
  @MinLength(1)
  characterId!: string;

  @IsString()
  @IsIn(['FULL', 'REDUCED'])
  variant!: 'FULL' | 'REDUCED';

  @IsString()
  @IsIn(['ALL', 'WEB', 'IOS', 'ANDROID'])
  platform!: 'ALL' | 'WEB' | 'IOS' | 'ANDROID';

  @IsString()
  @IsIn(['ALL', 'LOW', 'MID', 'HIGH', 'UNKNOWN'])
  deviceClass!: 'ALL' | 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN';

  @IsString()
  @Matches(/^(https:\/\/|\/assets\/)[^\s]{4,500}$/)
  publicUrl!: string;

  @IsString()
  @Matches(SHA256_PATTERN)
  sha256!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  bytes!: number;

  @IsString()
  @IsIn(['application/json', 'image/webp', 'image/png', 'video/webm'])
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(5_000)
  durationMs!: number;

  @IsBoolean()
  active!: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage!: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason!: string;
}

export class UpdateConceptKAssetRolloutDto {
  @IsBoolean()
  active!: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage!: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason!: string;
}

export class ResolveConceptKAssetDto {
  @IsString()
  @MaxLength(80)
  eventKey!: string;

  @IsBoolean()
  clientReducedMotion!: boolean;

  @IsString()
  @IsIn(['LOW', 'MID', 'HIGH', 'UNKNOWN'])
  deviceClass!: 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN';

  @IsString()
  @IsIn(['WEB', 'IOS', 'ANDROID'])
  platform!: 'WEB' | 'IOS' | 'ANDROID';
}
