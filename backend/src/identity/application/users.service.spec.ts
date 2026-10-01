import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyUser, UserRepository } from '../domain/user.repository.js';
import { UsersService } from './users.service.js';

const assignedAt = new Date('2026-01-15T10:00:00.000Z');

const companyUsers: CompanyUser[] = [
  {
    id: 'user-1',
    email: 'admin@empresa.com',
    name: 'Ana Admin',
    role: 'ADMIN',
    activeLicenseId: null,
    licenseAssignedAt: null,
  },
  {
    id: 'user-2',
    email: 'carlos@empresa.com',
    name: 'Carlos Usuario',
    role: 'USER',
    activeLicenseId: 'license-9',
    licenseAssignedAt: assignedAt.toISOString(),
  },
];

describe('UsersService', () => {
  let users: { findCompanyUsers: ReturnType<typeof vi.fn> };
  let service: UsersService;

  beforeEach(() => {
    users = { findCompanyUsers: vi.fn().mockResolvedValue(companyUsers) };
    service = new UsersService(users as unknown as UserRepository);
  });

  it('lists the users of the scoped company through the repository', async () => {
    await service.listCompanyUsers('company-1');

    expect(users.findCompanyUsers).toHaveBeenCalledWith('company-1');
  });

  it('returns users carrying their active license mapping', async () => {
    const result = await service.listCompanyUsers('company-1');

    expect(result).toHaveLength(2);
    expect(result.find((user) => user.id === 'user-2')).toEqual({
      id: 'user-2',
      email: 'carlos@empresa.com',
      name: 'Carlos Usuario',
      role: 'USER',
      activeLicenseId: 'license-9',
      licenseAssignedAt: assignedAt.toISOString(),
    });
    expect(result.find((user) => user.id === 'user-1')).toMatchObject({
      activeLicenseId: null,
      licenseAssignedAt: null,
    });
  });

  it('returns an empty list for a company without users', async () => {
    users.findCompanyUsers.mockResolvedValue([]);

    await expect(service.listCompanyUsers('empty-company')).resolves.toEqual([]);
  });
});
