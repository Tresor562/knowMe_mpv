import { IsIn, IsString, Matches } from 'class-validator';

export class SendMediaMessageDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,128}$/)
  assetId!: string;

  @IsIn(['GIF', 'STICKER_IMAGE', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'])
  kind!: 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
}
