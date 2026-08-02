import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min
} from 'class-validator';

export class RecordConceptKAssetDeliveryDto {
  @IsString()
  assetId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,160}$/)
  clientEventId!: string;

  @IsString()
  @IsIn(['PLAYED', 'LOAD_FAILED', 'INTEGRITY_FAILED'])
  outcome!: 'PLAYED' | 'LOAD_FAILED' | 'INTEGRITY_FAILED';

  @IsInt()
  @Min(0)
  @Max(10_000)
  durationMs!: number;

  @IsString()
  @IsIn(['WEB', 'IOS', 'ANDROID'])
  platform!: 'WEB' | 'IOS' | 'ANDROID';

  @IsString()
  @IsIn(['LOW', 'MID', 'HIGH', 'UNKNOWN'])
  deviceClass!: 'LOW' | 'MID' | 'HIGH' | 'UNKNOWN';

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  observedSha256?: string;
}

export class RestoreConceptKAssetDto {
  @IsString()
  @Matches(/^.{8,300}$/s)
  reason!: string;
}
