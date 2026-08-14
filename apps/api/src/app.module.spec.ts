import { Test } from '@nestjs/testing';

describe('AppModule provider graph', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.DATABASE_URL =
      previousDatabaseUrl ??
      'postgresql://validation:validation@127.0.0.1:5432/knowme';
    process.env.JWT_SECRET =
      previousJwtSecret ?? 'provider-graph-validation-secret';
  });

  afterAll(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  it(
    'resolves the complete application dependency graph',
    async () => {
      const { AppModule } = await import('./app.module');
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule]
      }).compile();

      await moduleRef.close();
    },
    30_000
  );
});
