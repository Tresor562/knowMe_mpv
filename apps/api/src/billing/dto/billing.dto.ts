import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min
} from 'class-validator';

const PLAN_KEY = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const ENTITLEMENT_KEY = /^[a-z0-9][a-z0-9._-]{2,99}$/;
const CURRENCY = /^[A-Z]{3}$/;
const COUNTRY = /^[A-Z]{2}$/;
const EXTERNAL_ID = /^[A-Za-z0-9._:/-]{3,200}$/;

export class CreateBillingPlanDto {
  @IsString()
  @Matches(PLAN_KEY)
  key!: string;

  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  highlighted?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresManualReview?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(ENTITLEMENT_KEY, { each: true })
  entitlements!: string[];
}

export class UpdateBillingPlanDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  highlighted?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresManualReview?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(ENTITLEMENT_KEY, { each: true })
  entitlements?: string[];

  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class CreateBillingPriceDto {
  @IsString()
  @Matches(/^[A-Z0-9_]{2,32}$/)
  provider!: string;

  @IsOptional()
  @IsString()
  @Matches(EXTERNAL_ID)
  externalPriceId?: string;

  @IsOptional()
  @IsIn(['ALL', 'WEB', 'ANDROID', 'IOS'])
  platform?: 'ALL' | 'WEB' | 'ANDROID' | 'IOS';

  @IsOptional()
  @IsString()
  @Matches(COUNTRY)
  countryCode?: string;

  @IsString()
  @Matches(CURRENCY)
  currency!: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  unitAmount!: number;

  @IsOptional()
  @IsIn(['DAY', 'WEEK', 'MONTH', 'YEAR'])
  interval?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  intervalCount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class BillingProviderEventDto {
  @IsString()
  @Matches(EXTERNAL_ID)
  eventId!: string;

  @IsString()
  @Length(3, 100)
  type!: string;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  @Length(10, 100)
  accountId!: string;

  @IsString()
  @Matches(PLAN_KEY)
  planKey!: string;

  @IsString()
  @Matches(EXTERNAL_ID)
  externalSubscriptionId!: string;

  @IsOptional()
  @IsString()
  @Matches(EXTERNAL_ID)
  externalPriceId?: string;

  @IsIn(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'REFUNDED'])
  status!: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'REFUNDED';

  @IsDateString()
  currentPeriodStart!: string;

  @IsDateString()
  currentPeriodEnd!: string;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
