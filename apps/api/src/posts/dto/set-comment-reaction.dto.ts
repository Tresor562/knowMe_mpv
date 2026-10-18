import { IsString, Length, Matches } from 'class-validator';

/** A single Unicode emoji or joined emoji sequence, never arbitrary text. */
export class SetCommentReactionDto {
  @IsString()
  @Length(1, 32)
  @Matches(/^(?=.*[\p{Extended_Pictographic}\p{Regional_Indicator}])[\p{Emoji}\p{Emoji_Component}\u200D\uFE0F\u20E3]+$/u, {
    message: 'Choisis un emoji valide pour réagir.'
  })
  emoji!: string;
}
