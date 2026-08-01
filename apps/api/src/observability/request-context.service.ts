import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextStore = {
  requestId: string;
  correlationId: string;
  startedAt: number;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  get(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  get requestId() {
    return this.get()?.requestId;
  }

  get correlationId() {
    return this.get()?.correlationId;
  }
}
