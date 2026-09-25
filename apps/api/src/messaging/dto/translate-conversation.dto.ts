import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length, Matches } from 'class-validator';

export class TranslateConversationDto {
  @IsString()
  @Matches(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/)
  targetLanguage!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Length(1, 180, { each: true })
  messageIds!: string[];
}
