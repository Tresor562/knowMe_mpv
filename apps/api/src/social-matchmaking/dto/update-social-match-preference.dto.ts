import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSocialMatchPreferenceDto {
  @IsOptional()
  @IsBoolean()
  matchmakingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNewPeople?: boolean;
}
