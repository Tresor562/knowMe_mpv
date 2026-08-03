import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength
} from 'class-validator';

const USER_ID = /^[A-Za-z0-9_-]{8,80}$/;
const GIFT_KEY = /^[a-z0-9][a-z0-9-]{2,48}$/;

export class SendSocialGiftDto {
  @IsString()
  @Matches(USER_ID)
  recipientId!: string;

  @IsString()
  @Matches(GIFT_KEY)
  giftKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  message?: string;
}

export class SocialGiftHistoryQueryDto {
  @IsOptional()
  @IsString()
  @Length(8, 80)
  cursor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([1-9]|[1-4][0-9]|50)$/)
  limit?: string;
}
