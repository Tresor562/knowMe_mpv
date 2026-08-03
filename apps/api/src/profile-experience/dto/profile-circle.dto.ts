import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength
} from 'class-validator';
import {
  PROFILE_AUDIENCES
} from '../profile-experience.domain';
import {
  PROFILE_CIRCLE_STATUS_ACTIONS
} from '../profile-circle.domain';

export class UpdateProfileCircleDto {
  @IsOptional() @IsString() @Length(2, 80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  sharedBio?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  bannerAssetId?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  emblemAssetId?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  animationKey?: string | null;

  @IsOptional() @IsString() @Length(7, 7)
  accentColor?: string;

  @IsOptional() @IsIn(PROFILE_AUDIENCES)
  visibility?: (typeof PROFILE_AUDIENCES)[number];

  @IsOptional() @IsBoolean()
  joinable?: boolean;
}

export class ProfileCircleLifecycleDto {
  @IsIn(PROFILE_CIRCLE_STATUS_ACTIONS)
  action!: (typeof PROFILE_CIRCLE_STATUS_ACTIONS)[number];

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

export class CreateProfileCircleJoinRequestDto {
  @IsOptional() @IsString() @MaxLength(500)
  message?: string;
}

export class ReviewProfileCircleJoinRequestDto {
  @IsIn(['APPROVE', 'DECLINE'])
  action!: 'APPROVE' | 'DECLINE';

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

export class RemoveProfileCircleMemberDto {
  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}
