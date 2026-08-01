import { IsIn, IsString, Length } from 'class-validator';

export class CreateReportDto {
  @IsIn(['USER', 'POST', 'COMMENT', 'MESSAGE', 'CHALLENGE'])
  targetType!: string;

  @IsString()
  @Length(1, 64)
  targetId!: string;

  @IsString()
  @Length(5, 500)
  reason!: string;
}
