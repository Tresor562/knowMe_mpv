import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(12)
  password!: string;
}
