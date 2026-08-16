import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SHORT_LINK_KINDS } from './short-links.domain';

export class CreateShortLinkDto {
  @IsString()
  @IsIn([...SHORT_LINK_KINDS])
  kind!: string;

  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]{6,128}$/)
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
