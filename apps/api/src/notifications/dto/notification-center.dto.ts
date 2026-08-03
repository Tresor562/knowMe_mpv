import {
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
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  NotificationDigestMode
} from '../notification-center.domain';

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean()
  masterEnabled?: boolean;

  @IsOptional() @IsBoolean()
  realtimeEnabled?: boolean;

  @IsOptional() @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional() @IsIn(['INSTANT', 'HOURLY', 'DAILY', 'OFF'])
  digestMode?: NotificationDigestMode;

  @IsOptional() @IsBoolean()
  quietHoursEnabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(1439)
  quietStartMinute?: number;

  @IsOptional() @IsInt() @Min(0) @Max(1439)
  quietEndMinute?: number;

  @IsOptional() @IsString() @MaxLength(80)
  timezone?: string;

  @IsOptional() @IsObject()
  categorySettings?: Partial<Record<NotificationCategory, boolean>>;

  @IsOptional() @IsArray()
  mutedTypes?: string[];

  @IsOptional() @IsArray()
  mutedCircleIds?: string[];
}

export class NotificationStateActionDto {
  @IsIn(['DISMISS', 'ARCHIVE', 'SNOOZE', 'RESTORE'])
  action!: 'DISMISS' | 'ARCHIVE' | 'SNOOZE' | 'RESTORE';

  @IsOptional() @IsInt() @Min(5) @Max(10080)
  snoozeMinutes?: number;

  @IsString() @MaxLength(120)
  idempotencyKey!: string;
}

export class RegisterNotificationPushEndpointDto {
  @IsIn(['ANDROID', 'IOS', 'WEB'])
  platform!: 'ANDROID' | 'IOS' | 'WEB';

  @IsString() @MaxLength(500)
  tokenReference!: string;

  @IsOptional() @IsString() @MaxLength(80)
  appVersion?: string;

  @IsOptional() @IsString() @MaxLength(80)
  deviceLabel?: string;
}

export class DisableNotificationPushEndpointDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{8,160}$/)
  endpointId!: string;
}

export const NOTIFICATION_CATEGORY_VALUES = NOTIFICATION_CATEGORIES;
