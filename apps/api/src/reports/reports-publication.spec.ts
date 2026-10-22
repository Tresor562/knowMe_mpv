import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('Authenticated publication reports', () => {
  function setup() {
    const prisma = {
      post: {
        findUnique: jest.fn().mockResolvedValue({ id: 'post-1', authorId: 'creator' })
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
      select: { id: true, authorId: true }
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

  it('forbids reporting your own publication through the API, even if the UI is bypassed', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue({ id: 'post-1', authorId: 'viewer' });
    await expect(service.create('viewer', dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
    expect(prisma.report.create).not.toHaveBeenCalled();
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


  it('paginates publication-only reports with a stable id cursor', async () => {
    const { service, prisma } = setup();
    const entries = Array.from({ length: 21 }, (_, n) => ({
      id: 'report-' + String(n).padStart(2, '0'), targetType: 'POST',
      targetId: 'post-' + n, reason: 'Spam', status: 'OPEN', createdAt: new Date()
    }));
    prisma.report.findMany.mockResolvedValue(entries);
    const result = await service.minePostReports('viewer');
    expect(result.reports).toHaveLength(20);
    expect(result.nextCursor).toBe('report-19');
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: { reporterId: 'viewer', targetType: 'POST' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      select: {
        id: true, targetType: true, targetId: true, reason: true,
        status: true, createdAt: true, resolvedAt: true
      }
    });
  });

  it('rejects a cursor belonging to another account or report type', async () => {
    const { service, prisma } = setup();
    await expect(service.minePostReports('viewer', 'not-my-report'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.report.findFirst).toHaveBeenCalledWith({
      where: { id: 'not-my-report', reporterId: 'viewer', targetType: 'POST' },
      select: { id: true }
    });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
  });

  it('rejects malformed cursors before database access', async () => {
    const { service, prisma } = setup();
    await expect(service.minePostReports('viewer', 'abc,foreign'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
    expect(prisma.report.findMany).not.toHaveBeenCalled();
  });

  it('returns later pages only after authorizing the pagination anchor', async () => {
    const { service, prisma } = setup();
    prisma.report.findFirst.mockResolvedValue({id:'report-19'});
    prisma.report.findMany.mockResolvedValue([{id:'report-20'}]);
    const result = await service.minePostReports('viewer', 'report-19');
    expect(result).toEqual({reports:[{id:'report-20'}],nextCursor:null});
    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { reporterId: 'viewer', targetType: 'POST' },
      cursor: { id: 'report-19' },
      skip: 1,
      take: 21
    }));
  });

  it('filters all pages by moderation status, without leaking a cursor from another status', async () => {
    const { service, prisma } = setup();
    prisma.report.findFirst.mockResolvedValue({ id: 'resolved-report' });
    await service.minePostReports('viewer', 'resolved-report', 'RESOLVED');
    expect(prisma.report.findFirst).toHaveBeenCalledWith({
      where: { id: 'resolved-report', reporterId: 'viewer',
        targetType: 'POST', status: 'RESOLVED' },
      select: { id: true }
    });
    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { reporterId: 'viewer', targetType: 'POST', status: 'RESOLVED' },
      cursor: { id: 'resolved-report' }, skip: 1
    }));
  });

  it('rejects repeated status and cursor query parameters safely', async () => {
    const { service, prisma } = setup();
    await expect(service.minePostReports('viewer', undefined, ['OPEN', 'RESOLVED'] as any))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.minePostReports('viewer', ['a', 'b'] as any, 'OPEN'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an unsupported moderation filter without touching report data', async () => {
    const { service, prisma } = setup();
    await expect(service.minePostReports('viewer', undefined, 'ADMIN'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
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
