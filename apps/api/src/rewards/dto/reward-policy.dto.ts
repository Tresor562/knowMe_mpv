import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from 'class-validator';

export class CreateRewardPolicyDto {
  @IsString()
  @Length(3, 80)
  key!: string;

  @IsString()
  @Length(3, 80)
  eventType!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  amount!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  dailyLimitPerUser!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPerEntity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minQuestions?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class SetRewardPolicyStatusDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
