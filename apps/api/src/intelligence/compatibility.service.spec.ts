import { CompatibilityService } from './compatibility.service';

describe('CompatibilityService', () => {
  it('is created with a Prisma dependency', () => {
    const prisma = {} as never;
    const service = new CompatibilityService(prisma);

    expect(service).toBeDefined();
  });
});
