import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class CreatePostDto {
  @IsString()
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
