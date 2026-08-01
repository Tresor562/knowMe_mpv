import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';

const PROVIDERS = ['APPLE', 'GOOGLE'] as const;
const PLATFORMS = ['ANDROID', 'IOS'] as const;
const KINDS = ['ENTITLEMENT', 'KNOWCOINS'] as const;

export class VerifyPurchaseDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Matches(/^[a-z0-9._:-]{3,100}$/)
  productKey!: string;

  @IsIn(PROVIDERS)
  provider!: string;

  @IsIn(PLATFORMS)
  platform!: string;

  @IsString()
  @Length(20, 30_000)
  receipt!: string;

  @IsString()
  @Length(20, 200)
  attestationId!: string;
}

export class UpsertStoreProductDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Matches(/^[a-z0-9._:-]{3,100}$/)
  key!: string;

  @IsIn(PROVIDERS)
  provider!: string;

  @IsIn(PLATFORMS)
  platform!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(3, 200)
  externalProductId!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(KINDS)
  kind!: string;

  @ValidateIf((dto: UpsertStoreProductDto) => dto.kind === 'ENTITLEMENT')
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @Matches(/^[a-z0-9._:-]{3,100}$/)
  entitlementKey?: string;

  @ValidateIf((dto: UpsertStoreProductDto) => dto.kind === 'KNOWCOINS')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  coinAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
