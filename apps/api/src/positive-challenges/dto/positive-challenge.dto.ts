import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const POSITIVE_CHALLENGE_KINDS = [
  'GRATITUDE_NOTE',
  'ENCOURAGEMENT',
  'HELPING_HAND',
  'SHARED_REFLECTION'
] as const;

export class CreatePositiveChallengeDto {
  @IsString()
  @MinLength(1)
  recipientId!: string;

  @IsString()
  @IsIn(POSITIVE_CHALLENGE_KINDS)
  kind!: (typeof POSITIVE_CHALLENGE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
