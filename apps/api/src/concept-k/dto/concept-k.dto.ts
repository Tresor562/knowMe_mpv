import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

const MODES = ['AUTO', 'REDUCED', 'OFF'] as const;
const DEVICE_CLASSES = ['LOW', 'MID', 'HIGH', 'UNKNOWN'] as const;
const PLATFORMS = ['WEB', 'IOS', 'ANDROID'] as const;
const OUTCOMES = ['PLAYED', 'FALLBACK', 'SKIPPED', 'ERROR'] as const;

export class UpdateAnimationPreferenceDto {
  @IsString()
  @IsIn(MODES)
  mode!: (typeof MODES)[number];

  @IsBoolean()
  soundEnabled!: boolean;

  @IsBoolean()
  hapticsEnabled!: boolean;
}

export class ResolveAnimationDto {
  @IsString()
  @MaxLength(80)
  eventKey!: string;

  @IsBoolean()
  clientReducedMotion!: boolean;

  @IsString()
  @IsIn(DEVICE_CLASSES)
  deviceClass!: (typeof DEVICE_CLASSES)[number];
}

export class RecordAnimationTelemetryDto extends ResolveAnimationDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,160}$/)
  clientEventId!: string;

  @IsString()
  @IsIn(OUTCOMES)
  outcome!: (typeof OUTCOMES)[number];

  @IsInt()
  @Min(0)
  @Max(10_000)
  durationMs!: number;

  @IsInt()
  @Min(0)
  @Max(2_000_000)
  assetBytes!: number;

  @IsString()
  @IsIn(PLATFORMS)
  platform!: (typeof PLATFORMS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  errorCode?: string;
}
