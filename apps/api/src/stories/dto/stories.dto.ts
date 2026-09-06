import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class CreateStoryDto {
  @IsIn(['TEXT', 'PHOTO', 'VIDEO', 'GIFT', 'ACHIEVEMENT', 'GAME', 'POLL', 'LINK'])
  type!: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'FRIENDS', 'FOLLOWERS', 'BEST_FRIENDS', 'CUSTOM', 'PRIVATE'])
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  caption?: string;

  @IsOptional()
  @IsObject()
  captionEntities?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  thumbnailAssetId?: string;

  @IsOptional()
  @IsString()
  giftInstanceId?: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsString()
  pollId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  linkUrl?: string;

  @IsOptional()
  @IsObject()
  background?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  musicAssetId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  musicStartMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  musicDurationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLongitude?: number;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  albumPosition?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  durationHours?: number;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReplies?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReactions?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSharing?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDownload?: boolean;

  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  isLive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  audienceUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  mentionUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  interactiveAreas?: Array<{
    type: 'LINK' | 'PROFILE' | 'HASHTAG' | 'LOCATION' | 'GAME' | 'POLL' | 'GIFT' | 'APP' | 'BOT';
    geometry: Record<string, unknown>;
    payload: Record<string, unknown>;
  }>;
}

export class CreateStoryBatchDto {
  @IsArray()
  @ArrayMaxSize(20)
  stories!: CreateStoryDto[];
}

export class StoryViewDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  completionBps?: number;

  @IsOptional()
  @IsBoolean()
  screenshot?: boolean;
}

export class StoryReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  reaction!: string;

  @IsOptional()
  @IsString()
  customEmojiId?: string;
}

export class StoryReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class CreateStoryAlbumDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  coverAssetId?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'FRIENDS', 'FOLLOWERS', 'BEST_FRIENDS', 'CUSTOM', 'PRIVATE'])
  audience?: string;
}
