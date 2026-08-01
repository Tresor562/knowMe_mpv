import { IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

const GRANT_SOURCES = ['ADMIN', 'STAFF', 'SYSTEM', 'MIGRATION'] as const;

export class GrantRoleDto {
  @IsString()
  @Length(10, 64)
  userId!: string;

  @IsString()
  @Length(2, 80)
  roleKey!: string;

  @IsOptional()
  @IsIn(GRANT_SOURCES)
  source?: (typeof GRANT_SOURCES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 160)
  externalReference?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class RevokeRoleGrantDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}
