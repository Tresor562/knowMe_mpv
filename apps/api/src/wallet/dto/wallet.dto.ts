import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  NotEquals
} from 'class-validator';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,160}$/;

export class AdjustKnowCoinsDto {
  @IsString()
  @Length(10, 64)
  userId!: string;

  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  @NotEquals(0)
  amount!: number;

  @IsString()
  @Matches(IDEMPOTENCY_KEY)
  idempotencyKey!: string;

  @IsString()
  @Length(3, 500)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  referenceId?: string;
}
