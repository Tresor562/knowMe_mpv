import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 500)
  @Matches(/\S/, { message: 'Le commentaire ne peut pas être vide.' })
  content!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  parentId?: string;
}
