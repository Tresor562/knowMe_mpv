import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min
} from 'class-validator';

export class CreateUploadSessionDto {
  @IsIn(['AVATAR', 'POST', 'MESSAGE', 'CHALLENGE', 'VERIFICATION'])
  purpose!: string;

  @IsIn(['PRIVATE', 'FRIENDS', 'CONVERSATION'])
  visibility!: string;

  @IsOptional()
  @IsString()
  @Length(10, 80)
  conversationId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1024)
  @Max(25 * 1024 * 1024)
  maxBytes!: number;

  @Transform(({ value }) => Array.isArray(value) ? value : [])
  @IsArray()
  @IsString({ each: true })
  allowedMime!: string[];
}

export class GrantMediaAccessDto {
  @IsString()
  @Length(10, 80)
  granteeId!: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
