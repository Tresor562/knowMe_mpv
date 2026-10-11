import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

/** Full post editing contract. Null clears the optional image. */
export class UpdatePostDto {
  @IsString()
  @Length(1, 2000)
  content!: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string | null;
}
