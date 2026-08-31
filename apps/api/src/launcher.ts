import { writeFileSync, writeSync } from 'node:fs';

type EntrypointFailureCategory = 'module-load' | 'uncaught-exception' | 'unhandled-rejection';

let terminating = false;

function persistEntrypointPhase(): void {
  if (process.env.KNOWME_STARTUP_PHASE_DIAGNOSTIC !== '1') return;
  try {
    writeFileSync('/tmp/knowme-startup-phase', 'launcher-enter', { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Diagnostics must never alter startup ownership or availability.
  }
}

function terminateEntrypoint(category: EntrypointFailureCategory): never {
  if (!terminating) {
    terminating = true;
    // This wrapper intentionally never receives or serializes the thrown value.
    // It exists only to prove whether execution failed before main.ts could own
    // the normal bounded bootstrap diagnostic path.
    writeSync(2, `[startup] API entrypoint failed before bootstrap (${category}).\n`);
  }
  process.exit(1);
}

persistEntrypointPhase();
process.once('uncaughtException', () => terminateEntrypoint('uncaught-exception'));
process.once('unhandledRejection', () => terminateEntrypoint('unhandled-rejection'));

try {
  // Keep main.ts behind an owned CommonJS boundary: TypeScript emits the API as
  // CommonJS, so this catches synchronous module-evaluation failures that happen
  // before main.ts can install its bootstrap().catch() handler.
  require('./main');
} catch {
  terminateEntrypoint('module-load');
}
