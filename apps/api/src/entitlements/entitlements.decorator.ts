import { SetMetadata } from '@nestjs/common';

export const ENTITLEMENTS_KEY = 'required_entitlements';

export const RequireEntitlements = (...keys: string[]) =>
  SetMetadata(ENTITLEMENTS_KEY, keys);
