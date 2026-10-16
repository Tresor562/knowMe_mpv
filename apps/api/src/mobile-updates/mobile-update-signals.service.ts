import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MobileUpdatesController } from './mobile-updates.controller';

/**
 * KnowMe-owned push for clients that are online and authenticated.
 * The existing Android WorkManager continues to provide background polling.
 * No Firebase / Google Play Services / third-party push provider involved.
 */
@Injectable()
export class MobileUpdateSignalsService implements OnModuleInit, OnModuleDestroy {
  private readonly intervalMs = 60_000;
  private interval: ReturnType<typeof setInterval> | null = null;
  private initial: ReturnType<typeof setTimeout> | null = null;
  private lastAnnouncedVersionCode = 0;
  private checking = false;

  constructor(
    private readonly updates: MobileUpdatesController,
    private readonly realtime: RealtimeGateway
  ) {}

  onModuleInit() {
    this.initial = setTimeout(() => { void this.checkOnce(); }, 10_000);
    this.initial.unref?.();
    this.interval = setInterval(() => { void this.checkOnce(); }, this.intervalMs);
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.initial) clearTimeout(this.initial);
    if (this.interval) clearInterval(this.interval);
  }

  async checkOnce() {
    if (this.checking) return;
    this.checking = true;
    try {
      const response = await this.updates.getAndroidUpdate();
      const release = response.release;
      if (
        release &&
        Number.isSafeInteger(release.versionCode) &&
        release.versionCode > this.lastAnnouncedVersionCode &&
        /^\d+\.\d+\.\d+$/.test(release.version)
      ) {
        // The payload is only an advisory; clients re-fetch the signed
        // manifest and never install based on a socket event alone.
        this.realtime.emitAndroidUpdateAvailable({
          versionCode: release.versionCode,
          version: release.version
        });
        this.lastAnnouncedVersionCode = release.versionCode;
      }
    } catch {
      // Network and release-discovery outages must never take down the API.
    } finally {
      this.checking = false;
    }
  }
}
