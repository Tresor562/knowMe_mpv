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

async function bootstrap() {
  resolveRuntimeReleaseIdentity();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void };
  express.set('trust proxy', createTrustedProxySetting());
  applyHttpServerTimeoutPolicy(app.getHttpServer());
  configureGracefulShutdown(app);
  app.use(createProductionHttpsGuard());
  app.enableCors(createCorsOptions());
  app.use(createSecurityHeadersMiddleware());
  app.use(createHttpObservabilityMiddleware());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
