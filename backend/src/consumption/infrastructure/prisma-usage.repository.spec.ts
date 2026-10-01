import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import { PrismaUsageRepository } from './prisma-usage.repository.js';

describe('PrismaUsageRepository', () => {
  let prisma: {
    company: { findUnique: ReturnType<typeof vi.fn> };
    license: { count: ReturnType<typeof vi.fn> };
    usageMetric: { findMany: ReturnType<typeof vi.fn> };
  };
  let repository: PrismaUsageRepository;

  beforeEach(() => {
    prisma = {
      company: { findUnique: vi.fn().mockResolvedValue(null) },
      license: { count: vi.fn().mockResolvedValue(4) },
      usageMetric: { findMany: vi.fn().mockResolvedValue([]) },
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
});
