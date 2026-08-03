import { IsIn, IsInt, Min } from 'class-validator';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale
} from '@knowme/i18n-contract';

export class UpdateLocalePreferenceDto {
  @IsIn([...SUPPORTED_LOCALES])
  locale!: SupportedLocale;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
