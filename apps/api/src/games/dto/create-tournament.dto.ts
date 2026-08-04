import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/)
  gameKey!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  teamSize!: number;

  @IsInt()
  @Min(2)
  @Max(32)
  maxEntrants!: number;

  @IsISO8601({ strict: true })
  registrationClosesAt!: string;

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
