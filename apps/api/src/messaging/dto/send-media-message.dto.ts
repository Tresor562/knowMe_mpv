import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import {
  MEDIA_MESSAGE_KINDS,
  VOICE_PRESETS,
  type MediaMessageKind,
  type VoicePreset
} from '../media-message-token.service';

export class SendMediaMessageDto {
  @IsIn([...MEDIA_MESSAGE_KINDS])
  kind!: MediaMessageKind;

  @IsString()
  @Length(8, 128)
  assetId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(600)
  durationSeconds!: number;

  @IsOptional()
  @IsIn([...VOICE_PRESETS])
  voicePreset?: VoicePreset;
}
