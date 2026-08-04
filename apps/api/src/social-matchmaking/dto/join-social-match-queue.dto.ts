import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import {
  SOCIAL_MATCH_PACES,
  SOCIAL_MATCH_PURPOSES,
  SOCIAL_MATCH_TOPICS
} from '../social-matchmaking.domain';

class SocialAvailabilityWindowDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;
}

export class JoinSocialMatchQueueDto {
  @IsIn(SOCIAL_MATCH_PURPOSES)
  purpose!: (typeof SOCIAL_MATCH_PURPOSES)[number];

  @IsIn(SOCIAL_MATCH_PACES)
  pace!: (typeof SOCIAL_MATCH_PACES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  languages!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsIn(SOCIAL_MATCH_TOPICS, { each: true })
  topics!: (typeof SOCIAL_MATCH_TOPICS)[number][];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => SocialAvailabilityWindowDto)
  availability!: SocialAvailabilityWindowDto[];

  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{8,120}$/)
  idempotencyKey!: string;
}
