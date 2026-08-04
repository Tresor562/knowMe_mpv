import { IsString, Matches, MaxLength } from 'class-validator';

export class RevokeSocialConnectionIntentDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
