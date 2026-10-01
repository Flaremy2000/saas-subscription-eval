import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import { PrismaUserRepository } from './prisma-user.repository.js';

const assignedAt = new Date('2026-01-15T10:00:00.000Z');

describe('PrismaUserRepository', () => {
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let repository: PrismaUserRepository;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'user-1',
            email: 'admin@empresa.com',
            name: 'Ana Admin',
            role: 'ADMIN',
            companyId: 'company-1',
            passwordHash: 'hash',
            licenses: [],
          },
          {
            id: 'user-2',
            email: 'carlos@empresa.com',
            name: 'Carlos Usuario',
            role: 'USER',
            companyId: 'company-1',
            passwordHash: 'hash',
            licenses: [{ id: 'license-9', assignedAt }],
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
        update: vi.fn().mockResolvedValue({
          id: 'user-2',
          email: 'user@empresa.com',
          name: 'Luis User',
          role: 'ADMIN',
          companyId: 'company-1',
          passwordHash: 'hash',
        }),
      },
    };
    repository = new PrismaUserRepository(prisma as unknown as PrismaService);
  });

  it('queries company users ordered by name with active licenses only', async () => {
    await repository.findCompanyUsers('company-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      include: {
        licenses: {
          where: { status: 'ACTIVE' },
          orderBy: { assignedAt: 'desc' },
          take: 1,
          select: { id: true, assignedAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('maps the active license onto the user payload', async () => {
    const users = await repository.findCompanyUsers('company-1');

    expect(users.find((user) => user.id === 'user-2')).toEqual({
      id: 'user-2',
      email: 'carlos@empresa.com',
      name: 'Carlos Usuario',
      role: 'USER',
      activeLicenseId: 'license-9',
      licenseAssignedAt: assignedAt.toISOString(),
    });
    expect(users.find((user) => user.id === 'user-1')).toMatchObject({
      activeLicenseId: null,
      licenseAssignedAt: null,
    });
  });

  it('looks up a user by email including the password hash', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(repository.findByEmail('admin@empresa.com')).resolves.toEqual({ id: 'user-1' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@empresa.com' },
    });
  });

  it('looks up a user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(repository.findById('missing')).resolves.toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'missing' } });
  });

  it('counts admins scoped to the company', async () => {
    await expect(repository.countAdmins('company-1')).resolves.toBe(2);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { companyId: 'company-1', role: 'ADMIN' },
    });
  });

  it('updates the role of a user', async () => {
    const updated = await repository.updateRole({ id: 'user-2', role: 'ADMIN' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { role: 'ADMIN' },
    });
    expect(updated.role).toBe('ADMIN');
  });
});
