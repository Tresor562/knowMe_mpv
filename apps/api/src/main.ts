import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createHttpObservabilityMiddleware } from './common/http-observability';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: ['x-request-id', 'x-correlation-id']
  });
  app.use(createHttpObservabilityMiddleware());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
