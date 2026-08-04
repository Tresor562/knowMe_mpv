import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export class CreateGameSessionDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,60}$/)
  gameKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, { each: true })
  opponentUsernames!: string[];

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
