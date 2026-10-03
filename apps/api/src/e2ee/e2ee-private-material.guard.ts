import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';

const FORBIDDEN_PRIVATE_MATERIAL_KEYS = new Set([
  'privatekey',
  'identityprivatekey',
  'signedprekeyprivate',
  'signedprekeyprivatekey',
  'onetimeprekeyprivate',
  'onetimeprekeyprivatekey',
  'prekeyprivatekey',
  'sessionkey',
  'ratchetkey',
  'rootkey',
  'chainkey',
  'sendchainkey',
  'receivechainkey'
]);

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function containsForbiddenPrivateMaterial(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenPrivateMaterial(item));
  }
  if (!value || typeof value !== 'object') return false;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PRIVATE_MATERIAL_KEYS.has(normalizedKey(key))) {
      return true;
    }
    if (containsForbiddenPrivateMaterial(nested)) return true;
  }
  return false;
}

@Injectable()
export class E2eePrivateMaterialGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ body?: unknown }>();
    if (containsForbiddenPrivateMaterial(request.body)) {
      throw new BadRequestException('E2EE_PRIVATE_KEY_MATERIAL_FORBIDDEN');
    }
    return true;
  }
}

export const e2eeContainsForbiddenPrivateMaterial =
  containsForbiddenPrivateMaterial;
