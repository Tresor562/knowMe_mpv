import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { E2EE_PROTOCOL } from './e2ee.domain';
import { SECRET_MESSAGE_KINDS, SecretMessageKind } from './secret-chat.domain';

export class CreateSecretConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @IsString({ each: true })
  memberIds!: string[];
}

export class SecretMessageEnvelopeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  recipientDeviceId!: string;

  @IsIn(SECRET_MESSAGE_KINDS)
  messageKind!: SecretMessageKind;

  @IsString()
  @MinLength(24)
  @MaxLength(131_072)
  ciphertext!: string;
}

export class SendSecretMessageDto {
  @IsIn([E2EE_PROTOCOL])
  protocol!: typeof E2EE_PROTOCOL;

  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,128}$/)
  clientMessageId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SecretMessageEnvelopeDto)
  envelopes!: SecretMessageEnvelopeDto[];
}
