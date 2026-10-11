import { IsOptional, IsString, Length } from 'class-validator';
export class SendMessageDto {
  @IsString() @Length(1, 4000)
  content!: string;

  @IsOptional() @IsString() @Length(1, 128)
  replyToId?: string;
}
