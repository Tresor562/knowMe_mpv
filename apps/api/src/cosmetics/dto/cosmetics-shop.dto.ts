import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class CreateCosmeticOfferDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{2,63}$/)
  key!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsInt()
  @Min(1)
  priceKnowCoins!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(240)
  reason!: string;
}

export class PurchaseCosmeticOfferDto {
  @IsString()
  @MinLength(1)
  offerId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,96}$/)
  clientPurchaseId!: string;
}
