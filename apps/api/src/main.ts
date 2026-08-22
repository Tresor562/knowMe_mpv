import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createCorsOptions } from './common/cors-policy';
import { configureGracefulShutdown } from './common/graceful-shutdown';
import { createHttpObservabilityMiddleware } from './common/http-observability';
import { createSecurityHeadersMiddleware } from './common/security-headers';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureGracefulShutdown(app);
  app.enableCors(createCorsOptions());
  app.use(createSecurityHeadersMiddleware());
  app.use(createHttpObservabilityMiddleware());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
