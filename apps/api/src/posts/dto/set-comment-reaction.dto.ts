import { IsString, Length } from 'class-validator';

export class SetCommentReactionDto {
  @IsString()
  @Length(1, 32)
  emoji!: string;
}
