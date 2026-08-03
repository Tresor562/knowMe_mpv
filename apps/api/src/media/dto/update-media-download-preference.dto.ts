import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Max,
  Min
} from 'class-validator';
import {
  MEDIA_KINDS,
  type MediaKind
} from '@knowme/media-cache-contract';

export class UpdateMediaDownloadPreferenceDto {
  @IsArray()
  @ArrayUnique()
  @IsIn([...MEDIA_KINDS], { each: true })
  wifiKinds!: MediaKind[];

  @IsArray()
  @ArrayUnique()
  @IsIn([...MEDIA_KINDS], { each: true })
  cellularKinds!: MediaKind[];

  @IsArray()
  @ArrayUnique()
  @IsIn([...MEDIA_KINDS], { each: true })
  roamingKinds!: MediaKind[];

  @IsBoolean()
  backgroundDownloads!: boolean;

  @IsBoolean()
  respectDataSaver!: boolean;

  @IsInt()
  @Min(64)
  @Max(4096)
  maxCacheMb!: number;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
