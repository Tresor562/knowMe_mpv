import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(20, 300)
  deviceToken?: string;
}
