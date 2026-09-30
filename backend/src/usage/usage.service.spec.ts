import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsageService } from './usage.service.js';

const company = {
  id: 'company-1',
  name: 'Acme',
  apiLimit: 1000,
  licenseLimit: 10,
  createdAt: new Date(),
};

describe('UsageService', () => {
  let prisma: {
    company: { findUnique: ReturnType<typeof vi.fn> };
    license: { count: ReturnType<typeof vi.fn> };
    usageMetric: { findMany: ReturnType<typeof vi.fn> };
  };
  let service: UsageService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: vi.fn().mockResolvedValue(company) },
      license: { count: vi.fn().mockResolvedValue(4) },
      usageMetric: {
        findMany: vi.fn().mockResolvedValue([
          { date: new Date(), apiCalls: 300 },
          { date: new Date(), apiCalls: 500 },
        ]),
      },
    };
    service = new UsageService(prisma as unknown as PrismaService);
  });

  it('aggregates licenses and API consumption for the window', async () => {
    const report = await service.getUsage('company-1');

    expect(prisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 'company-1' } });
    expect(prisma.license.count).toHaveBeenCalledWith({
      where: { companyId: 'company-1', status: 'ACTIVE' },
    });
    expect(prisma.usageMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', date: expect.anything() } }),
    );
    expect(report.company).toEqual({
      id: 'company-1',
      name: 'Acme',
      apiLimit: 1000,
      licenseLimit: 10,
    });
    expect(report.usage).toEqual({
      totalLicenses: 10,
      usedLicenses: 4,
      availableLicenses: 6,
      usagePercentage: 40,
    });
    expect(report.api).toEqual({ used: 800, limit: 1000, usagePercentage: 80, exceeded: false });
    expect(report.daily).toHaveLength(2);
    expect(report.daily[0]).toMatchObject({ date: expect.any(String), apiCalls: 300 });
  });

  it('warns when API usage reaches 80% of the limit', async () => {
    prisma.usageMetric.findMany.mockResolvedValue([{ date: new Date(), apiCalls: 800 }]);

    const report = await service.getUsage('company-1');

    expect(report.status).toBe('warning');
    expect(report.api.exceeded).toBe(false);
  });

  it('flags an exceeded limit when consumption surpasses the contract', async () => {
    prisma.usageMetric.findMany.mockResolvedValue([{ date: new Date(), apiCalls: 1200 }]);

    const report = await service.getUsage('company-1');

    expect(report.status).toBe('exceeded');
    expect(report.api).toMatchObject({ used: 1200, usagePercentage: 120, exceeded: true });
  });

  it('never reports a negative seat availability', async () => {
    prisma.license.count.mockResolvedValue(12);

    const report = await service.getUsage('company-1');

    expect(report.usage.availableLicenses).toBe(0);
  });

  it('throws when the company does not exist', async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    await expect(service.getUsage('missing')).rejects.toThrow(NotFoundException);
  });
});
