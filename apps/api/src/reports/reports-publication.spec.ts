import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('Authenticated publication reports', () => {
  function setup() {
    const prisma = {
      post: {
        findUnique: jest.fn().mockResolvedValue({ id: 'post-1' })
      },
      report: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'report-1',
          targetType: 'POST',
          targetId: 'post-1',
          reason: 'Spam ou publicité abusive',
          status: 'OPEN'
        }),
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const service = new ReportsService(prisma as any);
    return { service, prisma };
  }

  const dto = {
    targetType: 'POST',
    targetId: 'post-1',
    reason: '  Spam ou publicité abusive  '
  };

  it('creates a real report, only after confirming the post exists', async () => {
    const { service, prisma } = setup();
    const result = await service.create('viewer', dto);
    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      select: { id: true }
    });
    expect(prisma.report.findFirst).toHaveBeenCalledWith({
      where: {
        reporterId: 'viewer',
        targetType: 'POST',
        targetId: 'post-1',
        status: 'OPEN'
      }
    });
    expect(prisma.report.create).toHaveBeenCalledWith({
      data: {
        reporterId: 'viewer',
        targetType: 'POST',
        targetId: 'post-1',
        reason: 'Spam ou publicité abusive'
      },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true
      }
    });
    expect(result.status).toBe('OPEN');
  });

  it('rejects reports for deleted or non-existent publications', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.create('viewer', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('does not create a second open report from the same account', async () => {
    const { service, prisma } = setup();
    prisma.report.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create('viewer', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('reads only the authenticated account history, newest first and bounded', async () => {
    const { service, prisma } = setup();
    await service.mine('viewer');
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: { reporterId: 'viewer' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  });
});
