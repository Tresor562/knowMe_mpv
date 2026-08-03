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

export class UpdateAppearancePreferenceDto {
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsString()
  @MaxLength(40)
  themeKey?: string;

  @IsOptional()
  @IsIn(['STANDARD', 'HIGH'])
  contrast?: 'STANDARD' | 'HIGH';

  @IsOptional()
  @IsBoolean()
  reduceTransparency?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}
