import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class EmailAddressDto {
  @IsEmail() @MaxLength(254) email!: string;
}
export class EmailCodeDto extends EmailAddressDto {
  @IsString() @Length(6, 6) code!: string;
}
export class EmailRecoveryResetDto extends EmailCodeDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class EmailChangeRequestDto {
  @IsEmail() @MaxLength(254) newEmail!: string;
  @IsString() @MinLength(8) password!: string;
}
export class EmailChangeConfirmDto {
  @IsString() @Length(6, 6) code!: string;
}
