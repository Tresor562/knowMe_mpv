import { IsInt, Max, Min } from 'class-validator';

export class PinCreatorPostDto {
  @IsInt()
  @Min(0)
  @Max(2)
  position!: number;
}
