import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import { PrismaUsageRepository } from './prisma-usage.repository.js';

describe('PrismaUsageRepository', () => {
  let prisma: {
    company: { findUnique: ReturnType<typeof vi.fn> };
    license: { count: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
    usageMetric: { findMany: ReturnType<typeof vi.fn> };
    userUsageMetric: { findMany: ReturnType<typeof vi.fn> };
  };
  let repository: PrismaUsageRepository;

  beforeEach(() => {
    prisma = {
      company: { findUnique: vi.fn().mockResolvedValue(null) },
      license: { count: vi.fn().mockResolvedValue(4), findFirst: vi.fn().mockResolvedValue(null) },
      usageMetric: { findMany: vi.fn().mockResolvedValue([]) },
      userUsageMetric: { findMany: vi.fn().mockResolvedValue([]) },
    };
    repository = new PrismaUsageRepository(prisma as unknown as PrismaService);
  });

  it('fetches the company without loading relations', async () => {
    await repository.getCompany('company-1');

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      select: { id: true, name: true, apiLimit: true, licenseLimit: true },
    });
  });

  it('counts active licenses scoped to the company', async () => {
    await repository.countActiveLicenses('company-1');

    expect(prisma.license.count).toHaveBeenCalledWith({
      where: { companyId: 'company-1', status: 'ACTIVE' },
    });
  });

  it('queries daily metrics within the window ordered by date', async () => {
    const since = new Date('2026-09-01T00:00:00.000Z');
    prisma.usageMetric.findMany.mockResolvedValue([
      { date: new Date('2026-09-29T00:00:00.000Z'), apiCalls: 300 },
    ]);

    const metrics = await repository.getDailyMetrics('company-1', since);

    expect(prisma.usageMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', date: { gte: since } } }),
    );
    expect(metrics).toEqual([{ date: '2026-09-29', apiCalls: 300 }]);
  });

  describe('getPersonalUsage', () => {
    const since = new Date('2026-09-01T00:00:00.000Z');

    it('combines the preferred license with the personal series', async () => {
      prisma.license.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        assignedAt: new Date('2026-01-01T00:00:00.000Z'),
        revokedAt: null,
      });
      prisma.userUsageMetric.findMany.mockResolvedValue([
        { date: new Date('2026-09-29T00:00:00.000Z'), apiCalls: 100 },
      ]);

      const report = await repository.getPersonalUsage({
        companyId: 'company-1',
        userId: 'user-1',
        since,
      });

      expect(prisma.license.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', companyId: 'company-1' },
          orderBy: [{ status: 'asc' }, { assignedAt: 'desc' }],
        }),
      );
      expect(prisma.userUsageMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1', userId: 'user-1', date: { gte: since } },
        }),
      );
      expect(report.license).toEqual({
        status: 'ACTIVE',
        assignedAt: '2026-01-01T00:00:00.000Z',
        revokedAt: null,
      });
      expect(report.daily).toEqual([{ date: '2026-09-29', apiCalls: 100 }]);
    });

    it('reports NONE when the user never had a license', async () => {
      const report = await repository.getPersonalUsage({
        companyId: 'company-1',
        userId: 'user-new',
        since,
      });

      expect(report.license).toEqual({ status: 'NONE', assignedAt: null, revokedAt: null });
      expect(report.daily).toEqual([]);
    });

    it('serializes a revoked license timestamp', async () => {
      prisma.license.findFirst.mockResolvedValue({
        status: 'REVOKED',
        assignedAt: new Date('2026-01-01T00:00:00.000Z'),
        revokedAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      const report = await repository.getPersonalUsage({
        companyId: 'company-1',
        userId: 'user-1',
        since,
      });

      expect(report.license).toEqual({
        status: 'REVOKED',
        assignedAt: '2026-01-01T00:00:00.000Z',
        revokedAt: '2026-02-01T00:00:00.000Z',
      });
    });
  });
});
