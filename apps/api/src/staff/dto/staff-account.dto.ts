import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length
} from 'class-validator';

const STAFF_ROLES = [
  'OWNER',
  'ADMINISTRATOR',
  'MODERATOR',
  'SUPPORT',
  'DEVELOPER',
  'COMMUNITY_MANAGER'
] as const;

const STAFF_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED'] as const;

export class ActivateStaffAccountDto {
  @IsString()
  @Length(10, 64)
  userId!: string;

  @IsIn(STAFF_ROLES)
  staffRole!: (typeof STAFF_ROLES)[number];

  @IsOptional()
  @IsBoolean()
  grantsAdminAccess?: boolean;

  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class UpdateStaffAccountStatusDto {
  @IsIn(STAFF_STATUSES)
  status!: (typeof STAFF_STATUSES)[number];

  @IsString()
  @Length(3, 500)
  reason!: string;
}
