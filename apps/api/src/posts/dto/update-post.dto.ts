import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, IsUrl, Length } from 'class-validator';

/** Full post editing contract. Null clears the optional image. */
export class UpdatePostDto {
  @IsString()
  @Length(0, 2000)
  content!: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string | null;

  /** Omitted preserves attachments, [] removes them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(10, 80, { each: true })
  assetIds?: string[];
}
