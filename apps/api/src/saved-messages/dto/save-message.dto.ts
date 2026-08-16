import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  messageId!: string;
}
