import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

class ExperienceLevelDefinitionDto {
  @IsInt()
  @Min(1)
  @Max(500)
  level!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minimumXp!: number;

  @IsString()
  @Length(2, 80)
  title!: string;
}

export class PublishExperienceCurveDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ExperienceLevelDefinitionDto)
  levels!: ExperienceLevelDefinitionDto[];

  @IsString()
  @Length(3, 500)
  reason!: string;
}
