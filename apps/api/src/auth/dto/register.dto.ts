import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(3, 24)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username!: string;

  @IsString()
  @Length(2, 60)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
