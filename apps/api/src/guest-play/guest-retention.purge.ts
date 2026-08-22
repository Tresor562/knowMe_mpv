import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GuestRetentionService } from './guest-retention.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const retention = app.get(GuestRetentionService);
    const result = await retention.purgeExpired();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Guest retention purge failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
