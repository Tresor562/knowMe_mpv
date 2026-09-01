import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const securityCryptoService = await readFile(
  new URL('../apps/api/src/security/security-crypto.service.ts', import.meta.url),
  'utf8'
);

const CI_ACCOUNT_SECURITY_KEY =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

test('API application graph and real runtime boot receive an explicit CI-only account security key', () => {
  const bindings = workflow.match(
    new RegExp(`-e ACCOUNT_SECURITY_ENCRYPTION_KEY=${CI_ACCOUNT_SECURITY_KEY}`, 'g')
  ) ?? [];
  assert.equal(bindings.length, 2);
});

test('production account security encryption remains fail-closed when the key is missing', () => {
  assert.match(
    securityCryptoService,
    /const configured = this\.config\.get<string>\('ACCOUNT_SECURITY_ENCRYPTION_KEY'\)/
  );
  assert.match(securityCryptoService, /if \(configured\) \{/);
  assert.match(securityCryptoService, /if \(hex\.length === 32\) return hex/);

  const productionGuard = securityCryptoService.match(
    /if \(this\.config\.get<string>\('NODE_ENV'\) === 'production'\) \{([\s\S]*?)\n    \}/
  );
  assert.ok(productionGuard, 'production security-key guard must exist');
  assert.match(productionGuard[1], /ACCOUNT_SECURITY_ENCRYPTION_KEY est obligatoire en production/);
  assert.doesNotMatch(productionGuard[1], /JWT_SECRET/);

  const guardEnd = securityCryptoService.indexOf(productionGuard[0]) + productionGuard[0].length;
  const fallbackIndex = securityCryptoService.indexOf("this.config.get<string>('JWT_SECRET')", guardEnd);
  assert.ok(fallbackIndex > guardEnd, 'JWT fallback must remain outside the production guard');
});
