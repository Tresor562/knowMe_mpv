import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class IdentityEvidenceDto {
  @IsIn(['IDENTITY_DOCUMENT', 'SELFIE_CHECK', 'ADDRESS_CHECK', 'PROVIDER_ASSERTION'])
  type!:
    | 'IDENTITY_DOCUMENT'
    | 'SELFIE_CHECK'
    | 'ADDRESS_CHECK'
    | 'PROVIDER_ASSERTION';

  @IsString()
  @Matches(/^[A-Z0-9_]{2,32}$/)
  provider!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9._:/-]{8,200}$/)
  opaqueReference!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  digest!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubmitIdentityVerificationDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  displayNameClaim?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => IdentityEvidenceDto)
  evidence!: IdentityEvidenceDto[];
}

export class StartIdentityReviewDto {
  @IsInt()
  @Min(0)
  expectedDecisionVersion!: number;
}

export class DecideIdentityVerificationDto {
  @IsInt()
  @Min(0)
  expectedDecisionVersion!: number;

  @IsString()
  @Length(3, 1000)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(730)
  expiresInDays?: number;
}

export class WithdrawIdentityVerificationDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}
