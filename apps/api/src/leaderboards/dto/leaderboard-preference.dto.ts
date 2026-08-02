import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';

export class UpdateWeeklyLeaderboardPreferenceDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateIf((value: UpdateWeeklyLeaderboardPreferenceDto) => value.enabled)
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[\p{L}\p{N} ._-]+$/u, {
    message: 'Le pseudonyme contient des caractères non autorisés.'
  })
  displayAlias?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ignoredClientScore?: string;
}
