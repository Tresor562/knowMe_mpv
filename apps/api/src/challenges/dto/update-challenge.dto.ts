import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min
} from 'class-validator';

export class UpdateChallengeDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsIn(['PRIVATE', 'FRIENDS', 'PUBLIC'])
  visibility?: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  questions?: string[];

  @IsString()
  @Length(3, 500)
  changeReason!: string;
}
