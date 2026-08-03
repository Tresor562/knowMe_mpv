import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import {
  NotificationCenterCategory,
  NotificationCenterDigestMode
} from '../notification-center.domain';

export class UpdateNotificationCenterPreferencesDto {
  @IsOptional()
  @IsBoolean()
  masterEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  realtimeEnabled?: boolean;

  @IsOptional()
  @IsIn(['INSTANT', 'HOURLY', 'DAILY', 'CENTER_ONLY'])
  digestMode?: NotificationCenterDigestMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  dailyDigestMinute?: number;

  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  quietStartMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  quietEndMinute?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsObject()
  categorySettings?: Partial<Record<NotificationCenterCategory, boolean>>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  mutedTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  mutedCircleIds?: string[];
}

export class NotificationCenterStateActionDto {
  @IsIn(['DISMISS', 'ARCHIVE', 'SNOOZE', 'RESTORE'])
  action!: 'DISMISS' | 'ARCHIVE' | 'SNOOZE' | 'RESTORE';

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10_080)
  snoozeMinutes?: number;

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
