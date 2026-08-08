import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateCallDto {
  @IsString()
  @MinLength(1)
  calleeUserId!: string;

  @IsIn(['audio', 'video'])
  media!: 'audio' | 'video';

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}

export class EndCallDto {
  @IsString()
  @IsIn(['ended', 'rejected', 'cancelled'])
  reason!: 'ended' | 'rejected' | 'cancelled';
}
