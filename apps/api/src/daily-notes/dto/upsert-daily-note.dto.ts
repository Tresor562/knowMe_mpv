import { IsString, Length, Matches } from 'class-validator';

/** The chat thought is plain text, independent from story media and captions. */
export class UpsertDailyNoteDto {
  @IsString()
  @Length(1, 80)
  @Matches(/\S/, { message: 'La pensée ne peut pas être vide.' })
  content!: string;
}
