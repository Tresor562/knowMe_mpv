import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export const CREATOR_CATEGORIES = [
  'TECH',
  'EDUCATION',
  'GAMING',
  'LIFESTYLE',
  'ART',
  'MUSIC',
  'SPORT',
  'COMMUNITY',
  'OTHER'
] as const;

export class UpsertCreatorProfileDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{2,39}$/)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsIn([...CREATOR_CATEGORIES])
  category!: (typeof CREATOR_CATEGORIES)[number];

  @IsIn(['PUBLIC', 'UNLISTED'])
  visibility!: 'PUBLIC' | 'UNLISTED';

  @IsIn(['ACTIVE', 'PAUSED'])
  status!: 'ACTIVE' | 'PAUSED';

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
