import { IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

/** Full post editing contract. Null clears the optional image. */
export class UpdatePostDto {
  @IsString()
  @Length(1, 2000)
  @Matches(/\S/, { message: 'La publication ne peut pas être vide.' })
  content!: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string | null;
}
