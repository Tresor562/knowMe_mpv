import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

export class CreateGiftCampaignDto {
  @IsString()
  @Matches(KEY_PATTERN)
  key!: string;

  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(KEY_PATTERN)
  themeKey?: string;

  @IsBoolean()
  active!: boolean;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsString()
  @Length(5, 500)
  reason!: string;
}

export class CreateGiftDefinitionDto {
  @IsString()
  @Matches(KEY_PATTERN)
  key!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  version!: number;

  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @Matches(KEY_PATTERN)
  category!: string;

  @IsIn(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'])
  rarity!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  priceKnowCoins!: number;

  @IsUrl({ require_protocol: true })
  assetUrl!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  previewUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(KEY_PATTERN)
  animationKey?: string;

  @IsOptional()
  @IsString()
  @Matches(KEY_PATTERN)
  soundKey?: string;

  @IsBoolean()
  premiumOnly!: boolean;

  @IsBoolean()
  anonymousAllowed!: boolean;

  @IsBoolean()
  publicFeedAllowed!: boolean;

  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  campaignId?: string;

  @IsString()
  @Length(5, 500)
  reason!: string;
}

export class SendGiftDto {
  @IsString()
  @MinLength(1)
  receiverId!: string;

  @IsString()
  @MinLength(1)
  giftId!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;

  @IsBoolean()
  anonymous!: boolean;

  @IsIn(['PRIVATE', 'FRIENDS', 'PUBLIC'])
  visibility!: string;

  @IsOptional()
  @IsString()
  @Matches(KEY_PATTERN)
  contextType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contextId?: string;

  @IsString()
  @Matches(CLIENT_ID_PATTERN)
  clientSendId!: string;
}

export class UpdateGiftPreferenceDto {
  @IsIn(['EVERYONE', 'FRIENDS', 'NOBODY'])
  acceptMode!: string;

  @IsBoolean()
  anonymousGiftsAllowed!: boolean;

  @IsBoolean()
  publicMomentsAllowed!: boolean;
}

export class FeatureGiftDto {
  @IsBoolean()
  featured!: boolean;
}

export class ModerateGiftTransferDto {
  @IsIn(['VISIBLE', 'HIDDEN', 'REMOVED'])
  moderationState!: string;

  @IsString()
  @Length(5, 500)
  reason!: string;
}

export class UpdateGiftAvailabilityDto {
  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsString()
  @Length(5, 500)
  reason!: string;
}
