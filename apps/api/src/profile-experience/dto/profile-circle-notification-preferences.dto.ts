import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class UpdateProfileCircleNotificationPreferenceDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  invitationsEnabled!: boolean;

  @IsBoolean()
  membershipEnabled!: boolean;

  @IsBoolean()
  governanceEnabled!: boolean;

  @IsBoolean()
  contentEnabled!: boolean;

  @IsBoolean()
  familyEnabled!: boolean;

  @IsBoolean()
  realtimeEnabled!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  mutedCircleIds?: string[];

  @IsBoolean()
  quietHoursEnabled!: boolean;

  @IsInt() @Min(0) @Max(1439)
  quietStartMinute!: number;

  @IsInt() @Min(0) @Max(1439)
  quietEndMinute!: number;

  @IsString() @MaxLength(80)
  timezone!: string;

  @IsIn(['OFF', 'DAILY'])
  digestMode!: 'OFF' | 'DAILY';

  @IsInt() @Min(0) @Max(1439)
  digestMinuteOfDay!: number;
}
