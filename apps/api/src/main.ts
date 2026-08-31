import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createCorsOptions } from './common/cors-policy';
import { configureGracefulShutdown } from './common/graceful-shutdown';
import { applyHttpServerTimeoutPolicy } from './common/http-server-policy';
import { createHttpObservabilityMiddleware } from './common/http-observability';
import { resolveRuntimeReleaseIdentity } from './common/release-identity';
import { createSecurityHeadersMiddleware } from './common/security-headers';
import { createProductionHttpsGuard } from './common/transport-security';
import { createTrustedProxySetting } from './common/trusted-proxy-policy';

type BootstrapPhase =
  | 'release-identity'
  | 'nest-application-create'
  | 'runtime-policy-configuration'
  | 'http-listen'
  | 'ready';

let bootstrapPhase: BootstrapPhase = 'release-identity';

async function bootstrap() {
  bootstrapPhase = 'release-identity';
  resolveRuntimeReleaseIdentity();

  bootstrapPhase = 'nest-application-create';
  // Keep Nest fail-closed while allowing this entrypoint to own the final exit.
  // With abortOnError=true Nest may terminate the process internally before the
  // bounded, secret-safe bootstrap phase diagnostic below can be emitted.
  const app = await NestFactory.create(AppModule, { rawBody: true, abortOnError: false });

  bootstrapPhase = 'runtime-policy-configuration';
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void };
  express.set('trust proxy', createTrustedProxySetting());
  applyHttpServerTimeoutPolicy(app.getHttpServer());
  configureGracefulShutdown(app);
  app.use(createProductionHttpsGuard());
  app.enableCors(createCorsOptions());
  app.use(createSecurityHeadersMiddleware());
  app.use(createHttpObservabilityMiddleware());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  bootstrapPhase = 'http-listen';
  await app.listen(process.env.PORT ?? 4000);
  bootstrapPhase = 'ready';
}

bootstrap().catch(() => {
  // Deliberately emit only the bounded phase name. Startup exceptions may contain
  // database URIs, infrastructure details or other secrets and must not be copied
  // into CI/production logs merely to make a failed boot actionable.
  console.error(`[startup] API bootstrap failed during ${bootstrapPhase}.`);
  process.exitCode = 1;
});
