import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { COSMETIC_SLOTS } from '../../cosmetics/dto/cosmetics.dto';

export class RecordConsentDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Length(2, 80)
  policyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  policyVersion!: number;

  @IsOptional()
  @Transform(({ value }) => String(value ?? 'fr').trim().toLowerCase())
  @IsString()
  @Length(2, 12)
  locale?: string;

  @IsIn(['GRANT', 'WITHDRAW'])
  action!: 'GRANT' | 'WITHDRAW';

  @IsIn(['WEB', 'ANDROID', 'IOS', 'DESKTOP', 'SYSTEM'])
  source!: string;

  @IsString()
  @Length(16, 120)
  idempotencyKey!: string;
}

export class UpdatePrivacyPreferencesDto {
  @IsOptional()
  @IsIn(['PRIVATE', 'FRIENDS', 'PUBLIC'])
  profileVisibility?: string;

  @IsOptional()
  @IsIn(['FOLLOW_PROFILE', 'PRIVATE', 'FRIENDS', 'PUBLIC'])
  cosmeticVisibility?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(COSMETIC_SLOTS.length)
  @ArrayUnique()
  @IsIn(COSMETIC_SLOTS, { each: true })
  hiddenCosmeticSlots?: string[];

  @IsOptional()
  @IsBoolean()
  discoverability?: boolean;

  @IsOptional()
  @IsBoolean()
  personalizedRecommendations?: boolean;

  @IsOptional()
  @IsBoolean()
  analytics?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;

  @IsOptional()
  @IsBoolean()
  readReceipts?: boolean;

  @IsOptional()
  @IsBoolean()
  activityStatus?: boolean;
}

export class CreateDataSubjectRequestDto {
  @IsIn(['EXPORT', 'DELETE', 'CORRECT', 'RESTRICT', 'OBJECT'])
  type!: string;

  @IsString()
  @Length(16, 120)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class PublishPrivacyPolicyDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Length(2, 80)
  key!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @Transform(({ value }) => String(value ?? 'fr').trim().toLowerCase())
  @IsString()
  @Length(2, 12)
  locale!: string;

  @IsString()
  @Length(2, 160)
  title!: string;

  @IsString()
  @Length(10, 2000)
  summary!: string;

  @IsString()
  @Length(64, 64)
  contentHash!: string;

  @IsBoolean()
  required!: boolean;

  @IsString()
  effectiveAt!: string;
}

export class UpsertRetentionPolicyDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Length(2, 80)
  key!: string;

  @IsString()
  @Length(2, 80)
  resourceType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36500)
  retentionDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  gracePeriodDays!: number;

  @IsIn(['DELETE', 'ANONYMIZE'])
  action!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Length(3, 160)
  legalBasis!: string;

  @IsString()
  @Length(5, 500)
  reason!: string;
}
