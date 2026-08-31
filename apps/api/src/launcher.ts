import { writeSync } from 'node:fs';

type EntrypointFailureCategory = 'module-load' | 'uncaught-exception' | 'unhandled-rejection';

let terminating = false;

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
