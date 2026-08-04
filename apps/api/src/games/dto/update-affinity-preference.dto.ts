import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAffinityPreferenceDto {
  @IsOptional()
  @IsBoolean()
  invitationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  friendsOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultShareAnswers?: boolean;
}
