import { IsBoolean, IsInt, IsTimeZone, Max, Min } from 'class-validator';

export class UpdateCallPreferenceDto {
  @IsBoolean()
  incomingCallsEnabled!: boolean;

  @IsBoolean()
  allowAudioCalls!: boolean;

  @IsBoolean()
  allowVideoCalls!: boolean;

  @IsBoolean()
  quietHoursEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(1439)
  quietStartMinute!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  quietEndMinute!: number;

  @IsTimeZone()
  timezone!: string;

  @IsBoolean()
  microphoneEnabledByDefault!: boolean;

  @IsBoolean()
  cameraEnabledByDefault!: boolean;

  @IsBoolean()
  devicePreviewRequired!: boolean;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
