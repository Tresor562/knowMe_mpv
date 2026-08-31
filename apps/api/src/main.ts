type BootstrapPhase =
  | 'runtime-module-load'
  | 'release-identity'
  | 'application-module-load'
  | 'nest-application-create'
  | 'runtime-policy-configuration'
  | 'http-listen'
  | 'ready';

type StartupTracePhase = 'main-enter' | BootstrapPhase;
type StartupFailureCategory = 'module-resolution' | 'configuration' | 'runtime';

const STARTUP_CONFIGURATION_KEYS = [
  'API_HEADERS_TIMEOUT_MS',
  'API_INSTANCE_COUNT',
  'API_KEEP_ALIVE_TIMEOUT_MS',
  'API_RATE_LIMIT_LIMIT',
  'API_RATE_LIMIT_TTL_MS',
  'API_REQUEST_TIMEOUT_MS',
  'CORS_ALLOWED_ORIGINS_JSON',
  'MEDIA_ACCOUNT_QUOTA_BYTES',
  'MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS',
  'MEDIA_PURGE_ALERT_WEBHOOK_TOKEN',
  'MEDIA_PURGE_ALERT_WEBHOOK_URL',
  'MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS',
  'MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS',
  'MEDIA_S3_ACCESS_KEY_ID',
  'MEDIA_S3_BUCKET',
  'MEDIA_S3_ENDPOINT',
  'MEDIA_S3_MAX_ATTEMPTS',
  'MEDIA_S3_REGION',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'MEDIA_S3_TIMEOUT_MS',
  'MEDIA_SCANNER_TIMEOUT_MS',
  'MEDIA_SCANNER_TOKEN',
  'MEDIA_SCANNER_URL',
  'MEDIA_STORAGE_DRIVER',
  'MEDIA_UPLOAD_MAX_BYTES',
  'TRUSTED_PROXY_HOPS'
] as const;

let bootstrapPhase: BootstrapPhase = 'runtime-module-load';
let bootstrapFailureReported = false;

function persistStartupPhase(phase: StartupTracePhase): void {
  if (process.env.KNOWME_STARTUP_PHASE_DIAGNOSTIC !== '1') return;
  try {
    require('node:fs').writeFileSync('/app/.knowme-startup-phase', phase, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // CI phase evidence is best-effort and must never alter application startup.
  }
}

function setBootstrapPhase(phase: BootstrapPhase): void {
  bootstrapPhase = phase;
  persistStartupPhase(phase);
}

function writeStartupDiagnostic(message: string): void {
  // Runtime startup can end with no active event-loop handles. stderr is pipe-backed
  // in Docker, so console.error/process.stderr.write are not a durable last-chance
  // transport here. Keep this synchronous and pass only already-bounded text.
  require('node:fs').writeSync(2, `${message}\n`);
}

persistStartupPhase('main-enter');

// Some libraries may terminate the process directly instead of throwing. The
// normal bootstrap rejection handler cannot observe that path, but the exit
// event still can. Only synchronous I/O is safe in an exit handler; Docker
// captures stderr through a pipe, so an asynchronous stream write can be lost.
// Emit only the bounded phase/category and never inspect the terminating value.
process.once('exit', (code) => {
  if (code !== 0 && !bootstrapFailureReported) {
    writeStartupDiagnostic(`[startup] API process exited during ${bootstrapPhase} (unowned-exit).`);
  }
});

function classifyStartupFailure(failure: unknown): { category: StartupFailureCategory; key?: string } {
  if (!failure || typeof failure !== 'object') return { category: 'runtime' };

  const record = failure as { code?: unknown; message?: unknown };
  if (record.code === 'MODULE_NOT_FOUND' || record.code === 'ERR_MODULE_NOT_FOUND') {
    return { category: 'module-resolution' };
  }

  if (typeof record.message === 'string') {
    const message = record.message;
    const key = STARTUP_CONFIGURATION_KEYS.find((candidate) => message.includes(candidate));
    if (key) return { category: 'configuration', key };
  }

  return { category: 'runtime' };
}

async function bootstrap() {
  // Own every runtime dependency load inside the bootstrap promise. Keeping these
  // imports static would allow CommonJS module evaluation to fail before the
  // bounded bootstrap().catch() diagnostic below exists.
  setBootstrapPhase('runtime-module-load');
  const [
    { ValidationPipe },
    { NestFactory },
    { createCorsOptions },
    { configureGracefulShutdown },
    { applyHttpServerTimeoutPolicy },
    { createHttpObservabilityMiddleware },
    { resolveRuntimeReleaseIdentity },
    { createSecurityHeadersMiddleware },
    { createProductionHttpsGuard },
    { createTrustedProxySetting }
  ] = await Promise.all([
    import('@nestjs/common'),
    import('@nestjs/core'),
    import('./common/cors-policy'),
    import('./common/graceful-shutdown'),
    import('./common/http-server-policy'),
    import('./common/http-observability'),
    import('./common/release-identity'),
    import('./common/security-headers'),
    import('./common/transport-security'),
    import('./common/trusted-proxy-policy')
  ]);

  setBootstrapPhase('release-identity');
  resolveRuntimeReleaseIdentity();

  // Load the application graph inside the owned bootstrap promise. AppModule's
  // decorator evaluates production policies and imports the complete provider
  // graph; a failure during static module evaluation must therefore reject into
  // the bounded handler below instead of terminating before bootstrap() exists.
  setBootstrapPhase('application-module-load');
  const { AppModule } = await import('./app.module');

  setBootstrapPhase('nest-application-create');
  // Keep Nest fail-closed while allowing this entrypoint to own the final exit.
  // With abortOnError=true Nest may terminate the process internally before the
  // bounded, secret-safe bootstrap phase diagnostic below can be emitted.
  const app = await NestFactory.create(AppModule, { rawBody: true, abortOnError: false });

  setBootstrapPhase('runtime-policy-configuration');
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void };
  express.set('trust proxy', createTrustedProxySetting());
  applyHttpServerTimeoutPolicy(app.getHttpServer());
  configureGracefulShutdown(app);
  app.use(createProductionHttpsGuard());
  app.enableCors(createCorsOptions());
  app.use(createSecurityHeadersMiddleware());
  app.use(createHttpObservabilityMiddleware());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  setBootstrapPhase('http-listen');
  await app.listen(process.env.PORT ?? 4000);
  setBootstrapPhase('ready');
}

bootstrap().catch((failure: unknown) => {
  // Emit only a bounded phase plus an allowlisted category/configuration key.
  // Never copy the original message, stack, URI or environment value into logs.
  bootstrapFailureReported = true;
  const diagnostic = classifyStartupFailure(failure);
  const suffix = diagnostic.key ? ` (${diagnostic.category}:${diagnostic.key})` : ` (${diagnostic.category})`;
  writeStartupDiagnostic(`[startup] API bootstrap failed during ${bootstrapPhase}${suffix}.`);
  process.exitCode = 1;
});
