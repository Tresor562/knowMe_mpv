import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export class RegisterTournamentEntrantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  teamName?: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(/^[A-Za-z0-9_.-]{3,32}$/, { each: true })
  memberUsernames!: string[];

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
