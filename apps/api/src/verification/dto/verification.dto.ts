import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength
} from 'class-validator';

const SUBJECT_TYPES = ['PERSON', 'CREATOR', 'ORGANIZATION'] as const;
const PUBLIC_CATEGORIES = [
  'PERSON',
  'CREATOR',
  'JOURNALIST',
  'ARTIST',
  'ATHLETE',
  'BUSINESS',
  'ORGANIZATION',
  'PUBLIC_FIGURE'
] as const;
const DOCUMENT_KINDS = [
  'IDENTITY_FRONT',
  'IDENTITY_BACK',
  'SELFIE',
  'REGISTRATION',
  'AUTHORIZATION',
  'SUPPORTING_EVIDENCE'
] as const;
const DECISION_ACTIONS = [
  'NEEDS_INFO',
  'APPROVE',
  'REJECT',
  'SUSPEND',
  'REVOKE'
] as const;

export class CreateVerificationRequestDto {
  @IsIn(SUBJECT_TYPES)
  subjectType!: (typeof SUBJECT_TYPES)[number];

  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsIn(PUBLIC_CATEGORIES)
  publicCategory!: (typeof PUBLIC_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicReason?: string;

  @IsString()
  @Length(1, 40)
  termsVersion!: string;

  @IsBoolean()
  @Equals(true)
  termsAccepted!: boolean;
}

export class UploadVerificationDocumentDto {
  @IsIn(DOCUMENT_KINDS)
  kind!: (typeof DOCUMENT_KINDS)[number];
}

export class ReviewVerificationDto {
  @IsIn(DECISION_ACTIONS)
  action!: (typeof DECISION_ACTIONS)[number];

  @IsString()
  @Length(2, 60)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNote?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  badgeLabel?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export const verificationDocumentKinds = DOCUMENT_KINDS;
