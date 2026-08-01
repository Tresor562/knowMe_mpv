import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength
} from 'class-validator';

export class CreateChallengeDto {
  @IsString()
  @Length(3, 100)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsIn(['PRIVATE', 'FRIENDS', 'PUBLIC'])
  visibility?: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  questions!: string[];
}
