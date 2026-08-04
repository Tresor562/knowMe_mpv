import { IsString, MaxLength, MinLength } from 'class-validator';

export class GovernTournamentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason!: string;
}
