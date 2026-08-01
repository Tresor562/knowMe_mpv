import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches
} from 'class-validator';

const ENTITLEMENT_KEY = /^[a-z0-9][a-z0-9._-]{1,99}$/;
const SOURCES = [
  'ADMIN',
  'SUBSCRIPTION',
  'PURCHASE',
  'PROMOTION',
  'SYSTEM',
  'MIGRATION'
] as const;

export class GrantEntitlementDto {
  @IsString()
  userId!: string;

  @IsString()
  @Matches(ENTITLEMENT_KEY)
  key!: string;

  @IsString()
  @IsIn(SOURCES)
  source!: (typeof SOURCES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 200)
  externalReference?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RevokeEntitlementDto {
  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
