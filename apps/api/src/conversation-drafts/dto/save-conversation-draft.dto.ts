import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveConversationDraftDto {
  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}
