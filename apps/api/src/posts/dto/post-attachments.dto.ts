import { ArrayMaxSize, ArrayUnique, IsArray, IsString, Length } from 'class-validator';

/** Validated optional ordered list, never an arbitrary user-supplied media URL. */
export class PostAttachmentsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(10, 80, { each: true })
  assetIds!: string[];
}
