import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { SECRET_MESSAGE_CATEGORIES } from './knowme-secret.domain';
import { SECRET_CAMPAIGN_SOURCES, SECRET_ENTRY_POINTS } from './knowme-secret-flow.domain';

export class UpdateSecretPageDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsBoolean()
  profileEntryEnabled?: boolean;

  @IsOptional() @IsBoolean()
  allowUnauthenticatedSenders?: boolean;

  @IsOptional() @IsBoolean()
  requireChallengeVerification?: boolean;

  @IsOptional() @IsBoolean()
  publicMessageCountVisible?: boolean;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(30)
  slug?: string;

  @IsOptional() @IsString() @MaxLength(240)
  presentation?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(180)
  defaultPrompt?: string;

  @IsOptional() @IsInt() @Min(0) @Max(24 * 365)
  minimumAccountAgeHours?: number;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  dailyLimitPerSender?: number;

  @IsOptional() @IsDateString()
  pausedUntil?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true })
  blockedTerms?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(SECRET_MESSAGE_CATEGORIES, { each: true })
  acceptedCategories?: string[];
}

export class CreateSecretCampaignDto {
  @IsString() @MinLength(1) @MaxLength(180)
  prompt!: string;

  @IsOptional() @IsIn(SECRET_MESSAGE_CATEGORIES)
  category?: string;

  @IsOptional() @IsIn(SECRET_CAMPAIGN_SOURCES)
  source?: string;

  @IsOptional() @IsDateString()
  expiresAt?: string;

  @IsOptional() @IsInt() @Min(1) @Max(100_000)
  maximumMessages?: number;
}

export class SubmitSecretMessageDto {
  @IsString() @MinLength(1) @MaxLength(2_000)
  content!: string;

  @IsOptional() @IsIn(SECRET_MESSAGE_CATEGORIES)
  category?: string;

  @IsOptional() @IsString() @MaxLength(80)
  campaignToken?: string;

  @IsOptional() @IsIn(SECRET_ENTRY_POINTS)
  entryPoint?: string;

  @IsOptional() @IsString() @MinLength(16) @MaxLength(2_000)
  challengeProof?: string;
}

export class SecretReplyDto {
  @IsString() @MinLength(1) @MaxLength(2_000)
  answer!: string;

  @IsOptional() @IsIn(['PUBLIC', 'PRIVATE_DRAFT'])
  visibility?: string;

  @IsOptional() @IsString() @MaxLength(280)
  shareCaption?: string;
}
