import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createCorsOptions } from './common/cors-policy';
import { configureGracefulShutdown } from './common/graceful-shutdown';
import { createHttpObservabilityMiddleware } from './common/http-observability';
import { createSecurityHeadersMiddleware } from './common/security-headers';
import { createProductionHttpsGuard } from './common/transport-security';
import { createTrustedProxySetting } from './common/trusted-proxy-policy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void };
  express.set('trust proxy', createTrustedProxySetting());
  configureGracefulShutdown(app);
  app.use(createProductionHttpsGuard());
  app.enableCors(createCorsOptions());
  app.use(createSecurityHeadersMiddleware());
  app.use(createHttpObservabilityMiddleware());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
