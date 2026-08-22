import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const GUEST_AGE_GATE_STATES = ['UNKNOWN', 'ADULT', 'MINOR_ALLOWED'] as const;

export class CreateGuestSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[\p{L}\p{N} _.'-]+$/u)
  publicAlias?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  locale!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  consentVersion!: string;

  @IsString()
  @IsIn([...GUEST_AGE_GATE_STATES])
  ageGateState!: (typeof GUEST_AGE_GATE_STATES)[number];
}
