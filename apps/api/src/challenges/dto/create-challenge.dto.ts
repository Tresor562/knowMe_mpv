import { ArrayMinSize, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class CreateChallengeDto {
  @IsString() @Length(3, 100)
  title!: string;

  @IsOptional() @IsString() @Length(0, 500)
  description?: string;

  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  questions!: string[];
}
