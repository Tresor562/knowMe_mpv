import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength
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
}
