import { IsIn, IsString, Length } from 'class-validator';

export const TRANSFORMABLE_VOICE_PRESETS = ['DEEP', 'BRIGHT', 'ROBOT'] as const;
export type TransformableVoicePreset =
  (typeof TRANSFORMABLE_VOICE_PRESETS)[number];

export class TransformVoiceMessageDto {
  @IsString()
  @Length(8, 128)
  assetId!: string;

  @IsIn([...TRANSFORMABLE_VOICE_PRESETS])
  preset!: TransformableVoicePreset;
}
