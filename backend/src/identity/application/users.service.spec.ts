import { ConflictException, NotFoundException } from '@nestjs/common';
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
  let users: {
    findCompanyUsers: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    countAdmins: ReturnType<typeof vi.fn>;
    updateRole: ReturnType<typeof vi.fn>;
  };
  let service: UsersService;

  const actor: Express.User = {
    sub: 'admin-1',
    email: 'admin@empresa.com',
    name: 'Ana Admin',
    role: 'ADMIN',
    companyId: 'company-1',
  };

  const target = {
    id: 'user-2',
    email: 'user@empresa.com',
    name: 'Luis User',
    role: 'USER' as const,
    companyId: 'company-1',
    passwordHash: 'hash',
  };

  beforeEach(() => {
    users = {
      findCompanyUsers: vi.fn().mockResolvedValue(companyUsers),
      findById: vi.fn().mockResolvedValue(target),
      countAdmins: vi.fn().mockResolvedValue(2),
      updateRole: vi.fn().mockResolvedValue({ ...target, role: 'ADMIN' }),
    };
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

  describe('updateRole', () => {
    it('promotes a user within the admin company', async () => {
      const result = await service.updateRole(actor, 'user-2', 'ADMIN');

      expect(users.updateRole).toHaveBeenCalledWith({ id: 'user-2', role: 'ADMIN' });
      expect(result.user).toEqual({
        id: 'user-2',
        email: 'user@empresa.com',
        name: 'Luis User',
        role: 'ADMIN',
      });
    });

    it('demotes an admin when other admins remain', async () => {
      users.findById.mockResolvedValue({ ...target, id: 'user-3', role: 'ADMIN' });
      users.countAdmins.mockResolvedValue(3);
      users.updateRole.mockResolvedValue({ ...target, id: 'user-3', role: 'USER' });

      const result = await service.updateRole(actor, 'user-3', 'USER');

      expect(users.updateRole).toHaveBeenCalledWith({ id: 'user-3', role: 'USER' });
      expect(result.user.role).toBe('USER');
    });

    it('rejects unknown users', async () => {
      users.findById.mockResolvedValue(null);

      await expect(service.updateRole(actor, 'missing', 'ADMIN')).rejects.toThrow(
        NotFoundException,
      );
      expect(users.updateRole).not.toHaveBeenCalled();
    });

    it('rejects users outside the admin company', async () => {
      users.findById.mockResolvedValue({ ...target, companyId: 'company-2' });

      await expect(service.updateRole(actor, target.id, 'ADMIN')).rejects.toThrow(
        NotFoundException,
      );
      expect(users.updateRole).not.toHaveBeenCalled();
    });

    it('rejects changing your own role', async () => {
      users.findById.mockResolvedValue({ ...target, id: 'admin-1' });

      await expect(service.updateRole(actor, 'admin-1', 'USER')).rejects.toThrow(ConflictException);
      expect(users.updateRole).not.toHaveBeenCalled();
    });

    it('rejects demoting the last admin of the company', async () => {
      users.findById.mockResolvedValue({ ...target, id: 'user-3', role: 'ADMIN' });
      users.countAdmins.mockResolvedValue(1);

      await expect(service.updateRole(actor, 'user-3', 'USER')).rejects.toThrow(ConflictException);
      expect(users.updateRole).not.toHaveBeenCalled();
      expect(users.countAdmins).toHaveBeenCalledWith('company-1');
    });

    it('does not count admins when promoting a plain user', async () => {
      await service.updateRole(actor, 'user-2', 'ADMIN');

      expect(users.countAdmins).not.toHaveBeenCalled();
    });
  });
});
