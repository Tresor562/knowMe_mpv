import { IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class ApplyModerationActionDto {
  @IsIn(['USER'])
  targetType!: string;

  @IsString()
  @Length(1, 64)
  targetId!: string;

  @IsIn(['RATE_LIMIT', 'CONTENT_LOCK'])
  action!: string;

  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
