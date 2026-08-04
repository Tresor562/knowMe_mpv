import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class SetSocialConnectionIntentDto {
  @IsBoolean()
  wantsFriendship!: boolean;

  @IsBoolean()
  wantsConversation!: boolean;

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
