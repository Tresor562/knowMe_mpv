import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class PasswordProofDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class ConfirmTwoFactorDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/)
  code!: string;
}

export class DisableTwoFactorDto extends PasswordProofDto {
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/)
  code!: string;
}

export class RegenerateRecoveryCodesDto extends DisableTwoFactorDto {}

export class VerifyLoginTwoFactorDto {
  @IsString()
  @Length(20, 300)
  challengeToken!: string;

  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/)
  code!: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  deviceLabel?: string;

  @IsOptional()
  @IsIn(['WEB', 'ANDROID', 'IOS', 'DESKTOP', 'UNKNOWN'])
  platform?: string;
}

export class ReauthenticateDto extends PasswordProofDto {
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/)
  code?: string;
}

export class ChangePasswordDto extends ReauthenticateDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  @Matches(/[a-z]/, { message: 'Le nouveau mot de passe doit contenir une minuscule.' })
  @Matches(/[A-Z]/, { message: 'Le nouveau mot de passe doit contenir une majuscule.' })
  @Matches(/\d/, { message: 'Le nouveau mot de passe doit contenir un chiffre.' })
  newPassword!: string;
}

export class RenameDeviceDto {
  @IsString()
  @Length(2, 80)
  label!: string;
}
