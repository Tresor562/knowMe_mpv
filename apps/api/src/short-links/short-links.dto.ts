import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SHORT_LINK_TARGET_TYPES } from './short-links.domain';

export class CreateShortLinkDto {
  @IsString()
  @IsIn(SHORT_LINK_TARGET_TYPES)
  targetType!: string;

  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/)
  targetId!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}

export class RevokeShortLinkDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
