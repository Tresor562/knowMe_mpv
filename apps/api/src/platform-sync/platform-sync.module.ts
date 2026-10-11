import { Module } from '@nestjs/common';
import { PlatformSyncController } from './platform-sync.controller';

@Module({ controllers: [PlatformSyncController] })
export class PlatformSyncModule {}
