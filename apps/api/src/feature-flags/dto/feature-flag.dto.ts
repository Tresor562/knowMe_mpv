import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min
} from 'class-validator';

const FLAG_KEY = /^[a-z0-9][a-z0-9._-]{1,99}$/;
const RISK_LEVELS = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

export class CreateFeatureFlagDto {
  @IsString()
  @Matches(FLAG_KEY)
  key!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  exposeToClient?: boolean;

  @IsOptional()
  @IsIn(RISK_LEVELS)
  riskLevel?: (typeof RISK_LEVELS)[number];

  @IsOptional()
  @IsString()
  @Length(1, 120)
  owner?: string;

  @IsOptional()
  @IsISO8601()
  reviewAt?: string;
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  exposeToClient?: boolean;

  @IsOptional()
  @IsIn(RISK_LEVELS)
  riskLevel?: (typeof RISK_LEVELS)[number];

  @IsOptional()
  @IsString()
  @Length(1, 120)
  owner?: string;

  @IsOptional()
  @IsISO8601()
  reviewAt?: string;
}

export class CreateFeatureFlagRuleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  platform?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(?:\.\d+){0,3}$/)
  minVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  audience?: string;

  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority?: number;
}

export class SetFeatureFlagOverrideDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
