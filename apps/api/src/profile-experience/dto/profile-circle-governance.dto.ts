import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import {
  PROFILE_CIRCLE_ROLES,
  PROFILE_FAMILY_RELATION_TYPES
} from '../profile-circle-governance.domain';

export class UpdateProfileCircleRoleDto {
  @IsIn(PROFILE_CIRCLE_ROLES)
  role!: (typeof PROFILE_CIRCLE_ROLES)[number];
}

export class CreateProfileCircleOwnershipTransferDto {
  @IsString() @MaxLength(160)
  toUserId!: string;

  @IsOptional() @IsInt() @Min(1) @Max(168)
  expiresInHours?: number;

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

export class CreateProfileCircleMomentDto {
  @IsIn(['TEXT', 'PHOTO', 'DRAWING', 'GIF', 'GIFT', 'ACHIEVEMENT'])
  type!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  text?: string;

  @IsOptional() @IsString() @MaxLength(160)
  assetId?: string;

  @IsOptional() @IsString() @MaxLength(160)
  giftInstanceId?: string;

  @IsIn(['PUBLIC', 'MEMBERS'])
  audience!: 'PUBLIC' | 'MEMBERS';
}

export class CreateProfileCircleStoryDto {
  @IsIn(['TEXT', 'PHOTO', 'VIDEO', 'GIFT', 'ACHIEVEMENT'])
  type!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  text?: string;

  @IsOptional() @IsString() @MaxLength(160)
  assetId?: string;

  @IsOptional() @IsString() @MaxLength(160)
  giftInstanceId?: string;

  @IsIn(['PUBLIC', 'MEMBERS'])
  audience!: 'PUBLIC' | 'MEMBERS';

  @IsInt() @Min(1) @Max(72)
  durationHours!: number;
}

export class ModerateProfileCircleContentDto {
  @IsIn(['APPROVE', 'HIDE', 'REMOVE'])
  action!: 'APPROVE' | 'HIDE' | 'REMOVE';

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

export class CreateProfileFamilyRelationDto {
  @IsString() @MaxLength(160)
  otherUserId!: string;

  @IsIn(PROFILE_FAMILY_RELATION_TYPES)
  type!: (typeof PROFILE_FAMILY_RELATION_TYPES)[number];

  @IsOptional() @IsString() @MaxLength(120)
  label?: string;
}

export class ProfileFamilyRelationActionDto {
  @IsIn(['ACCEPT', 'DECLINE', 'REMOVE'])
  action!: 'ACCEPT' | 'DECLINE' | 'REMOVE';
}
