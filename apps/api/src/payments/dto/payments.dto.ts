import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf
} from 'class-validator';

const PRODUCT_KEY = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const COUNTRY = /^[A-Z]{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const EXTERNAL_ID = /^[A-Za-z0-9._:/+\-=]{3,500}$/;

export class CreatePaymentOrderDto {
  @IsString()
  @Matches(PRODUCT_KEY)
  productKey!: string;

  @IsIn(['FLUTTERWAVE', 'CINETPAY'])
  provider!: 'FLUTTERWAVE' | 'CINETPAY';

  @IsOptional()
  @IsString()
  @Matches(COUNTRY)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(6, 32)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string;

  @IsOptional()
  @IsString()
  @Matches(COUNTRY)
  customerCountryCode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  state?: string;

  @IsOptional()
  @IsString()
  @Length(2, 12)
  postalCode?: string;
}

export class VerifyStorePurchaseDto {
  @IsString()
  @Matches(PRODUCT_KEY)
  productKey!: string;

  @IsIn(['GOOGLE_PLAY', 'APPLE_APP_STORE'])
  provider!: 'GOOGLE_PLAY' | 'APPLE_APP_STORE';

  @IsString()
  @Matches(EXTERNAL_ID)
  externalProductId!: string;

  @ValidateIf((value) => value.provider === 'GOOGLE_PLAY')
  @IsString()
  @Matches(EXTERNAL_ID)
  purchaseToken?: string;

  @ValidateIf((value) => value.provider === 'APPLE_APP_STORE')
  @IsString()
  @Matches(EXTERNAL_ID)
  transactionId?: string;
}

export class RequestPaymentRefundDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;

  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,160}$/)
  idempotencyKey!: string;
}

export class ResolvePaymentFraudDto {
  @IsIn(['RESOLVED', 'DISMISSED', 'CONFIRMED'])
  status!: 'RESOLVED' | 'DISMISSED' | 'CONFIRMED';

  @IsString()
  @Length(5, 500)
  reason!: string;
}
