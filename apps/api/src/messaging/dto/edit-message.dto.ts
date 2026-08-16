import {
  IsDefined,
  IsISO8601,
  IsString,
  Length,
  ValidateIf
} from 'class-validator';

export class EditMessageDto {
  @IsString()
  @Length(1, 4000)
  content!: string;

  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  expectedEditedAt!: string | null;
}
