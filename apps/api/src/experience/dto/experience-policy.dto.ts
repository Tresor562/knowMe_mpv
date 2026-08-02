import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from 'class-validator';

export class CreateExperiencePolicyDto {
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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000)
  minQuestions?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class SetExperiencePolicyStatusDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
