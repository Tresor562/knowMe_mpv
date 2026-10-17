import { IsString, Length, Matches } from 'class-validator';

/** Editing is limited to non-empty comments, same boundary as creation. */
export class EditCommentDto {
  @IsString()
  @Length(1, 500)
  @Matches(/\S/, { message: 'Le commentaire ne peut pas être vide.' })
  content!: string;
}
