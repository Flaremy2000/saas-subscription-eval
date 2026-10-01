import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageRepository } from '../domain/usage.repository.js';
import { UsageService } from './usage.service.js';

const company = {
  id: 'company-1',
  name: 'Acme',
  apiLimit: 1000,
  licenseLimit: 10,
};

describe('UsageService', () => {
  let repository: {
    getCompany: ReturnType<typeof vi.fn>;
    countActiveLicenses: ReturnType<typeof vi.fn>;
    getDailyMetrics: ReturnType<typeof vi.fn>;
    getPersonalUsage: ReturnType<typeof vi.fn>;
  };
  let service: UsageService;

  beforeEach(() => {
    repository = {
      getCompany: vi.fn().mockResolvedValue(company),
      countActiveLicenses: vi.fn().mockResolvedValue(4),
      getDailyMetrics: vi.fn().mockResolvedValue([
        { date: '2026-09-29', apiCalls: 300 },
        { date: '2026-09-30', apiCalls: 500 },
      ]),
      getPersonalUsage: vi.fn().mockResolvedValue({
        license: {
          status: 'ACTIVE',
          assignedAt: '2026-01-01T00:00:00.000Z',
          revokedAt: null,
        },
        daily: [
          { date: '2026-09-29', apiCalls: 100 },
          { date: '2026-09-30', apiCalls: 260 },
        ],
      }),
    };
    service = new UsageService(repository as unknown as UsageRepository);
  });

  it('aggregates licenses and API consumption for the window', async () => {
    const report = await service.getUsage('company-1');

    expect(repository.getCompany).toHaveBeenCalledWith('company-1');
    expect(repository.countActiveLicenses).toHaveBeenCalledWith('company-1');
    expect(repository.getDailyMetrics).toHaveBeenCalledWith('company-1', expect.any(Date));
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
    expect(report.daily[0]).toMatchObject({ date: '2026-09-29', apiCalls: 300 });
  });

  it('warns when API usage reaches 80% of the limit', async () => {
    repository.getDailyMetrics.mockResolvedValue([{ date: '2026-09-30', apiCalls: 800 }]);

    const report = await service.getUsage('company-1');

    expect(report.status).toBe('warning');
    expect(report.api.exceeded).toBe(false);
  });

  it('flags an exceeded limit when consumption surpasses the contract', async () => {
    repository.getDailyMetrics.mockResolvedValue([{ date: '2026-09-30', apiCalls: 1200 }]);

    const report = await service.getUsage('company-1');

    expect(report.status).toBe('exceeded');
    expect(report.api).toMatchObject({ used: 1200, usagePercentage: 120, exceeded: true });
  });

  it('never reports a negative seat availability', async () => {
    repository.countActiveLicenses.mockResolvedValue(12);

    const report = await service.getUsage('company-1');

    expect(report.usage.availableLicenses).toBe(0);
  });

  it('handles a company without contracted limits', async () => {
    repository.getCompany.mockResolvedValue({ ...company, apiLimit: 0, licenseLimit: 0 });

    const report = await service.getUsage('company-1');

    expect(report.usage).toMatchObject({
      totalLicenses: 0,
      availableLicenses: 0,
      usagePercentage: 0,
    });
    expect(report.api).toMatchObject({ limit: 0, usagePercentage: 0, exceeded: true });
    expect(report.status).toBe('exceeded');
  });

  it('throws when the company does not exist', async () => {
    repository.getCompany.mockResolvedValue(null);

    await expect(service.getUsage('missing')).rejects.toThrow(NotFoundException);
  });

  describe('getPersonalUsage', () => {
    it('reports the personal series with license status and daily average', async () => {
      const report = await service.getPersonalUsage('company-1', 'user-1');

      expect(repository.getPersonalUsage).toHaveBeenCalledWith({
        companyId: 'company-1',
        userId: 'user-1',
        since: expect.any(Date),
      });
      expect(report.license.status).toBe('ACTIVE');
      expect(report.api).toEqual({ used: 360, daily: 180 });
      expect(report.daily).toHaveLength(2);
    });

    it('reports a missing license as NONE', async () => {
      repository.getPersonalUsage.mockResolvedValue({
        license: { status: 'NONE', assignedAt: null, revokedAt: null },
        daily: [{ date: '2026-09-30', apiCalls: 40 }],
      });

      const report = await service.getPersonalUsage('company-1', 'user-without-license');

      expect(report.license).toEqual({ status: 'NONE', assignedAt: null, revokedAt: null });
      expect(report.api).toEqual({ used: 40, daily: 40 });
    });

    it('handles a user with no metrics in the window', async () => {
      repository.getPersonalUsage.mockResolvedValue({
        license: {
          status: 'REVOKED',
          assignedAt: '2026-01-01T00:00:00.000Z',
          revokedAt: '2026-02-01T00:00:00.000Z',
        },
        daily: [],
      });

      const report = await service.getPersonalUsage('company-1', 'user-1');

      expect(report.api).toEqual({ used: 0, daily: 0 });
      expect(report.daily).toEqual([]);
    });
  });
});
