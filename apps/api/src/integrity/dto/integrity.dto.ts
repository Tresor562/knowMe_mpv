import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength
} from 'class-validator';

const PLATFORMS = ['ANDROID', 'IOS'] as const;

export class CreateAttestationChallengeDto {
  @IsIn(PLATFORMS)
  platform!: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Matches(/^[a-z0-9._:-]{3,80}$/)
  action!: string;
}

export class VerifyAttestationDto extends CreateAttestationChallengeDto {
  @IsString()
  @Length(20, 200)
  nonce!: string;

  @IsString()
  @Length(20, 12_000)
  token!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(8, 160)
  deviceId!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(3, 200)
  appIdentifier!: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(200)
  keyIdentifier?: string;
}
