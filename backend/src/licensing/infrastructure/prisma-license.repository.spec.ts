import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import {
  CompanyNotFoundError,
  DuplicateLicenseError,
  SeatLimitReachedError,
} from '../domain/license.repository.js';
import { PrismaLicenseRepository } from './prisma-license.repository.js';

const company = {
  id: 'company-1',
  name: 'Acme',
  apiLimit: 100000,
  licenseLimit: 5,
  createdAt: new Date(),
};

describe('PrismaLicenseRepository', () => {
  let prisma: {
    company: { findUnique: ReturnType<typeof vi.fn> };
    license: {
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let repository: PrismaLicenseRepository;

  beforeEach(() => {
    prisma = {
      company: { findUnique: vi.fn().mockResolvedValue(company) },
      license: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(3),
        create: vi.fn().mockResolvedValue({
          id: 'license-1',
          userId: 'user-2',
          companyId: 'company-1',
          status: 'ACTIVE',
          assignedAt: new Date('2026-01-01T00:00:00.000Z'),
          revokedAt: null,
        }),
      },
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    );
    repository = new PrismaLicenseRepository(prisma as unknown as PrismaService);
  });

  it('assigns inside a serializable transaction', async () => {
    const result = await repository.assign({ userId: 'user-2', companyId: 'company-1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    expect(prisma.license.create).toHaveBeenCalledWith({
      data: { userId: 'user-2', companyId: 'company-1' },
    });
    expect(result).toEqual({
      id: 'license-1',
      userId: 'user-2',
      companyId: 'company-1',
      status: 'ACTIVE',
      assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('rejects users who already hold an active license', async () => {
    prisma.license.findFirst.mockResolvedValue({
      id: 'license-0',
      userId: 'user-2',
      companyId: 'company-1',
      status: 'ACTIVE',
      assignedAt: new Date(),
      revokedAt: null,
    });

    await expect(repository.assign({ userId: 'user-2', companyId: 'company-1' })).rejects.toThrow(
      DuplicateLicenseError,
    );
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it('rejects assignment beyond the contracted limit', async () => {
    prisma.license.count.mockResolvedValue(5);

    await expect(repository.assign({ userId: 'user-2', companyId: 'company-1' })).rejects.toThrow(
      SeatLimitReachedError,
    );
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it('rejects when the company no longer exists', async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    await expect(repository.assign({ userId: 'user-2', companyId: 'missing' })).rejects.toThrow(
      CompanyNotFoundError,
    );
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it('counts active licenses for a company', async () => {
    await expect(repository.countActive('company-1')).resolves.toBe(3);
    expect(prisma.license.count).toHaveBeenCalledWith({
      where: { companyId: 'company-1', status: 'ACTIVE' },
    });
  });
});
