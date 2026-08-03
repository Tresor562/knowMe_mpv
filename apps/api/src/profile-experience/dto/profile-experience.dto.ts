import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import {
  PROFILE_AUDIENCES,
  PROFILE_CIRCLE_TYPES,
  PROFILE_GUARD_SCOPES,
  PROFILE_SECTIONS
} from '../profile-experience.domain';

export class UpdateProfileExperienceDto {
  @IsOptional() @IsString() @MaxLength(160)
  coverAssetId?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  coverVideoAssetId?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  frameAssetId?: string | null;

  @IsOptional() @IsString() @Length(2, 80)
  themeKey?: string;

  @IsOptional() @IsString() @MaxLength(80)
  effectKey?: string | null;

  @IsOptional() @IsObject()
  intelligentBio?: Record<string, unknown> | null;

  @IsOptional() @IsBoolean()
  influencerMode?: boolean;

  @IsOptional() @IsIn(['PUBLIC', 'FRIENDS', 'DISABLED'])
  wallMode?: 'PUBLIC' | 'FRIENDS' | 'DISABLED';

  @IsOptional() @IsBoolean()
  profileLocked?: boolean;

  @IsOptional() @IsBoolean()
  profileEvolutionEnabled?: boolean;

  @IsOptional() @IsBoolean()
  weatherEffectsEnabled?: boolean;

  @IsOptional() @IsBoolean()
  seasonalEffectsEnabled?: boolean;

  @IsOptional() @IsBoolean()
  birthdayEffectsEnabled?: boolean;

  @IsOptional() @IsBoolean()
  animatedAvatarEnabled?: boolean;
}

export class UpdateProfileVisibilityDto {
  @IsArray()
  rules!: Array<{
    section: (typeof PROFILE_SECTIONS)[number];
    audience: (typeof PROFILE_AUDIENCES)[number];
    allowedWhenLocked: boolean;
  }>;
}

export class UpdateProfileGuardDto {
  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  scopes!: Array<(typeof PROFILE_GUARD_SCOPES)[number]>;

  @IsOptional() @IsIn(['GLASS', 'CRYSTAL', 'NEON', 'GOLD', 'PREMIUM', 'ANIME', 'CYBER', 'GALAXY', 'MAGIC'])
  style?: string;

  @IsBoolean()
  warnViewer!: boolean;

  @IsBoolean()
  notifyOwner!: boolean;

  @IsBoolean()
  platformDisclosureAccepted!: boolean;
}

export class CreateProfileCircleDto {
  @IsIn(PROFILE_CIRCLE_TYPES)
  type!: (typeof PROFILE_CIRCLE_TYPES)[number];

  @IsString() @Length(2, 80)
  name!: string;

  @IsArray()
  memberUserIds!: string[];

  @IsOptional() @IsString() @MaxLength(160)
  sharedBio?: string;

  @IsOptional() @IsString() @MaxLength(80)
  animationKey?: string;

  @IsOptional() @IsString() @Length(7, 7)
  accentColor?: string;
}

export class CreateProfileWallPostDto {
  @IsIn(['TEXT', 'PHOTO', 'DRAWING', 'GIF', 'GIFT'])
  contentType!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  text?: string;

  @IsOptional() @IsString() @MaxLength(160)
  assetId?: string;

  @IsOptional() @IsString() @MaxLength(160)
  giftInstanceId?: string;
}

export class CreateProfileMemoryDto {
  @IsIn(['AVATAR', 'COVER', 'USERNAME', 'THEME', 'SEASONAL_BADGE', 'PRECIOUS_GIFT', 'MOMENT_CAPTURE'])
  type!: string;

  @IsString() @Length(1, 120)
  label!: string;

  @IsOptional() @IsString() @MaxLength(160)
  assetId?: string;

  @IsOptional() @IsString() @MaxLength(500)
  privateValue?: string;

  @IsOptional() @IsString() @MaxLength(80)
  sourceType?: string;

  @IsOptional() @IsString() @MaxLength(160)
  sourceId?: string;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional() @IsDateString()
  capturedAt?: string;
}

export class RecordProfileCaptureEventDto {
  @IsString()
  ownerUserId!: string;

  @IsIn(['ANDROID', 'IOS', 'WEB', 'DESKTOP', 'UNKNOWN'])
  platform!: 'ANDROID' | 'IOS' | 'WEB' | 'DESKTOP' | 'UNKNOWN';

  @IsIn([
    'SCREENSHOT_ATTEMPT',
    'SCREENSHOT_COMPLETED',
    'SCREEN_RECORDING_STARTED',
    'SCREEN_RECORDING_STOPPED',
    'SCREEN_MIRRORING_STARTED',
    'SCREEN_MIRRORING_STOPPED',
    'SECURE_SURFACE_BLOCKED'
  ])
  eventType!: string;

  @IsIn(PROFILE_GUARD_SCOPES)
  scope!: (typeof PROFILE_GUARD_SCOPES)[number];

  @IsBoolean()
  nativeSignal!: boolean;

  @IsOptional() @IsString() @MaxLength(4000)
  attestationToken?: string;

  @IsOptional() @IsDateString()
  clientOccurredAt?: string;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateProfileStatsDto {
  @IsObject()
  metrics!: Record<string, number | string | boolean | null>;

  @IsOptional() @IsInt() @Min(1) @Max(1000)
  version?: number;
}
