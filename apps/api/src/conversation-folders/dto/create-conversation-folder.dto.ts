import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateConversationFolderDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}
