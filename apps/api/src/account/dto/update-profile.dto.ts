import {
  IsOptional,
  IsString,
  IsUrl,
  Length
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  bio?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
