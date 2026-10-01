import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRecord, UserRepository } from '../../identity/domain/user.repository.js';
import {
  CompanyNotFoundError,
  DuplicateLicenseError,
  SeatLimitReachedError,
} from '../domain/license.repository.js';
import type { LicenseRepository } from '../domain/license.repository.js';
import { LicensesService } from './licenses.service.js';
import type { AssignLicenseRequest } from '../presentation/dto/assign-license.request.js';

const admin: Express.User = {
  sub: 'admin-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'company-1',
};

const target: UserRecord = {
  id: 'user-2',
  email: 'user@empresa.com',
  name: 'Luis User',
  role: 'USER',
  companyId: 'company-1',
  passwordHash: 'hash',
};

const assignedLicense = {
  id: 'license-1',
  userId: 'user-2',
  companyId: 'company-1',
  status: 'ACTIVE' as const,
  assignedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const dto: AssignLicenseRequest = { userId: 'user-2' };

describe('LicensesService', () => {
  let users: { findById: ReturnType<typeof vi.fn> };
  let licenses: { assign: ReturnType<typeof vi.fn>; countActive: ReturnType<typeof vi.fn> };
  let service: LicensesService;

  beforeEach(() => {
    users = { findById: vi.fn().mockResolvedValue(target) };
    licenses = { assign: vi.fn().mockResolvedValue(assignedLicense), countActive: vi.fn() };
    service = new LicensesService(
      users as unknown as UserRepository,
      licenses as unknown as LicenseRepository,
    );
  });

  it('assigns an active license within the admin company', async () => {
    const result = await service.assign(admin, dto);

    expect(licenses.assign).toHaveBeenCalledWith({ userId: 'user-2', companyId: 'company-1' });
    expect(result).toEqual({
      success: true,
      message: 'License assigned successfully',
      license: assignedLicense,
    });
  });

  it('rejects unknown users without touching the license repository', async () => {
    users.findById.mockResolvedValue(null);

    await expect(service.assign(admin, dto)).rejects.toThrow(NotFoundException);
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  it('rejects users outside the admin company', async () => {
    users.findById.mockResolvedValue({ ...target, companyId: 'company-2' });

    await expect(service.assign(admin, dto)).rejects.toThrow(NotFoundException);
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  it('maps a duplicate assignment to a conflict', async () => {
    licenses.assign.mockRejectedValue(new DuplicateLicenseError());

    await expect(service.assign(admin, dto)).rejects.toThrow(ConflictException);
  });

  it('maps a reached seat limit to a forbidden response', async () => {
    licenses.assign.mockRejectedValue(new SeatLimitReachedError());

    await expect(service.assign(admin, dto)).rejects.toThrow(ForbiddenException);
  });

  it('maps a missing company to a not found response', async () => {
    licenses.assign.mockRejectedValue(new CompanyNotFoundError());

    await expect(service.assign(admin, dto)).rejects.toThrow(NotFoundException);
  });
});
