import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, Length, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({each:true})
  mediaAssetIds?: string[];

  @IsOptional()
  @IsString()
  @Length(10, 80)
  mediaAssetId?: string;
}
