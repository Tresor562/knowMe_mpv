import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GovernCreatorProfileDto {
  @IsBoolean()
  suspended!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason?: string;
}
