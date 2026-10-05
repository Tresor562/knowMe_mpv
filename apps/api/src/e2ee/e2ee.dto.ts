import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { E2EE_PROTOCOL } from './e2ee.domain';

export class E2eeOneTimePreKeyDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  keyId!: number;

  @IsString()
  @MinLength(40)
  @MaxLength(4096)
  publicKey!: string;
}

export class RegisterE2eeDeviceDto {
  @IsIn([E2EE_PROTOCOL])
  protocol!: typeof E2EE_PROTOCOL;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  registrationId!: number;

  @IsString()
  @MinLength(40)
  @MaxLength(4096)
  identityKey!: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  signedPreKeyId!: number;

  @IsString()
  @MinLength(40)
  @MaxLength(4096)
  signedPreKey!: string;

  @IsString()
  @MinLength(40)
  @MaxLength(4096)
  signedPreKeySignature!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => E2eeOneTimePreKeyDto)
  oneTimePreKeys?: E2eeOneTimePreKeyDto[];
}

export class ReplenishE2eePreKeysDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => E2eeOneTimePreKeyDto)
  oneTimePreKeys!: E2eeOneTimePreKeyDto[];
}
