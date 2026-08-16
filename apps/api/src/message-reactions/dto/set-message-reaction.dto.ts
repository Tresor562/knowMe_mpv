import { IsIn } from 'class-validator';

export const STANDARD_MESSAGE_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '🎉'] as const;

export class SetMessageReactionDto {
  @IsIn(STANDARD_MESSAGE_REACTIONS)
  emoji!: (typeof STANDARD_MESSAGE_REACTIONS)[number];
}
