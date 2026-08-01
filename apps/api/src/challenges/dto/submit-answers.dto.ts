import { ArrayMinSize, IsArray, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ChallengeAnswerInputDto {
  @IsString()
  questionId!: string;

  @IsString()
  @Length(1, 500)
  value!: string;
}

export class SubmitAnswersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChallengeAnswerInputDto)
  answers!: ChallengeAnswerInputDto[];
}
