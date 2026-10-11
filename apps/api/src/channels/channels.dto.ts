import { ChannelVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateChannelDto {
  @IsString() @MinLength(1) @MaxLength(72)
  name!: string;

  @IsOptional() @IsString() @MaxLength(512)
  description?: string;

  @IsOptional() @IsString()
  @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/)
  username?: string;

  @IsOptional() @IsEnum(ChannelVisibility)
  visibility?: ChannelVisibility;
}

export class UpdateChannelDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(72)
  name?: string;

  @IsOptional() @IsString() @MaxLength(512)
  description?: string;

  @IsOptional() @IsString()
  @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/)
  username?: string;

  @IsOptional() @IsEnum(ChannelVisibility)
  visibility?: ChannelVisibility;
}

export class PublishChannelPostDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  content!: string;
}
