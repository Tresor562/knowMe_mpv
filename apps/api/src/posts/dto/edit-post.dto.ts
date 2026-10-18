import { IsString } from 'class-validator';

/** No arbitrary word limit on KnowMe posts. Empty text is permitted only
 * when an existing attached media object remains (checked in PostsService). */
export class EditPostDto {
  @IsString()
  content!: string;
}
