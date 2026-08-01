import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
export class CreateConversationDto {
  @IsOptional() @IsString()
  title?: string;

  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  memberIds!: string[];
}
