import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignLicenseRequest } from './dto/assign-license.request.js';
import { LicensesService } from './licenses.service.js';

const admin = {
  sub: 'admin-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN' as const,
  companyId: 'company-1',
};

const target = {
  id: 'user-2',
  email: 'user@empresa.com',
  name: 'Luis User',
  role: 'USER' as const,
  companyId: 'company-1',
  passwordHash: 'hash',
  createdAt: new Date(),
};

const company = {
  id: 'company-1',
  name: 'Acme',
  apiLimit: 100000,
  licenseLimit: 5,
  createdAt: new Date(),
};

const dto: AssignLicenseRequest = { userId: 'user-2' };

describe('LicensesService', () => {
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    company: { findUnique: ReturnType<typeof vi.fn> };
    license: {
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: LicensesService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(target) },
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
    service = new LicensesService(prisma as unknown as PrismaService);
  });

  it('assigns an active license inside a serializable transaction', async () => {
    const result = await service.assign(admin, dto);

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
      success: true,
      message: 'License assigned successfully',
      license: {
        id: 'license-1',
        userId: 'user-2',
        companyId: 'company-1',
        status: 'ACTIVE',
        assignedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  });

  it('rejects unknown users before opening a transaction', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.assign(admin, dto)).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects users outside the admin company', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...target, companyId: 'company-2' });

    await expect(service.assign(admin, dto)).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

    await expect(service.assign(admin, dto)).rejects.toThrow(ConflictException);
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it('rejects assignment beyond the contracted limit', async () => {
    prisma.license.count.mockResolvedValue(5);

    await expect(service.assign(admin, dto)).rejects.toThrow(ForbiddenException);
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it('rejects when the admin company no longer exists', async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    await expect(service.assign(admin, dto)).rejects.toThrow(NotFoundException);
    expect(prisma.license.create).not.toHaveBeenCalled();
  });
});
