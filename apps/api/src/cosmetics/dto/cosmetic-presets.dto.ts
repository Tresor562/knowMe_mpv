import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateNested
} from 'class-validator';
import { COSMETIC_SLOTS } from './cosmetics.dto';

export class CosmeticPresetItemInputDto {
  @IsString()
  @IsIn(COSMETIC_SLOTS)
  slot!: (typeof COSMETIC_SLOTS)[number];

  @IsString()
  @MinLength(1)
  itemId!: string;
}

export class CreateCosmeticPresetDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(COSMETIC_SLOTS.length)
  @ArrayUnique((entry: CosmeticPresetItemInputDto) => entry.slot)
  @ValidateNested({ each: true })
  @Type(() => CosmeticPresetItemInputDto)
  items!: CosmeticPresetItemInputDto[];

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class UpdateCosmeticPresetDto {
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(2, 60)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(COSMETIC_SLOTS.length)
  @ArrayUnique((entry: CosmeticPresetItemInputDto) => entry.slot)
  @ValidateNested({ each: true })
  @Type(() => CosmeticPresetItemInputDto)
  items?: CosmeticPresetItemInputDto[];

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class ActivateCosmeticPresetDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Length(16, 120)
  idempotencyKey!: string;
}
