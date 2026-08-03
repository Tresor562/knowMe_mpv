import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

const normalizedKey = ({ value }: { value: unknown }) => String(value ?? '').trim().toLowerCase();

export class UpdateAppearancePreferenceDto {
  @IsOptional()
  @Transform(normalizedKey)
  @IsString()
  @MaxLength(60)
  themeKey?: string;

  @IsOptional()
  @Transform(normalizedKey)
  @IsString()
  @MaxLength(60)
  iconPackKey?: string;

  @IsOptional()
  @Transform(normalizedKey)
  @IsString()
  @MaxLength(60)
  appIconKey?: string;

  @IsOptional()
  @IsIn(['STANDARD', 'HIGH'])
  contrast?: 'STANDARD' | 'HIGH';

  @IsOptional()
  @IsBoolean()
  reduceTransparency?: boolean;

  @IsOptional()
  @IsBoolean()
  animationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  animatedIconsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  uiSoundsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  weatherEffectsEnabled?: boolean;

  @IsOptional()
  @IsIn(['LOW', 'BALANCED', 'HIGH'])
  effectIntensity?: 'LOW' | 'BALANCED' | 'HIGH';

  @IsOptional()
  @IsIn(['OFF', 'TIME', 'SEASON'])
  automaticRotationMode?: 'OFF' | 'TIME' | 'SEASON';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}
