import {
  IsInt,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class SubmitGameActionDto {
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z][A-Z0-9_]{1,39}$/)
  actionType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  expectedSequence!: number;

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
