import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SelectAchievementTitleDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  grantId?: string | null;
}

export class RevokeAchievementGrantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
