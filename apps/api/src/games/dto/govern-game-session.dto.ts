import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class GovernGameSessionDto {
  @IsIn(['CANCEL'])
  action!: 'CANCEL';

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
