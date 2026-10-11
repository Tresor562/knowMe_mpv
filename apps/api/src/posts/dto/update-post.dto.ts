import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

/** Author-only changes. Publication ownership and moderation are enforced server-side. */
export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  content?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
