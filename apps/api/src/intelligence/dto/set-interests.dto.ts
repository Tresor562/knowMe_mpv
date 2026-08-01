import { ArrayMinSize, IsArray, IsString, Length } from 'class-validator';

export class SetInterestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Length(2, 40, { each: true })
  interests!: string[];
}
