import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpsertDailyNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'Écris au moins un caractère non vide.' })
  content!: string;
}
