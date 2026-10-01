import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

const assignedAt = new Date('2026-01-15T10:00:00.000Z');

const admin = {
  id: 'user-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN' as const,
  passwordHash: 'hash',
  companyId: 'company-1',
  createdAt: new Date(),
};

const member = {
  id: 'user-2',
  email: 'carlos@empresa.com',
  name: 'Carlos Usuario',
  role: 'USER' as const,
  passwordHash: 'hash',
  companyId: 'company-1',
  createdAt: new Date(),
};

describe('UsersService', () => {
  let prisma: { user: { findMany: ReturnType<typeof vi.fn> } };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          { ...admin, licenses: [] },
          { ...member, licenses: [{ id: 'license-9', assignedAt }] },
        ]),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('queries company users ordered by name with active licenses only', async () => {
    await service.listCompanyUsers('company-1');

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
    const users = await service.listCompanyUsers('company-1');

    expect(users).toHaveLength(2);
    expect(users.find((user) => user.id === 'user-2')).toEqual({
      id: 'user-2',
      email: 'carlos@empresa.com',
      name: 'Carlos Usuario',
      role: 'USER',
      activeLicenseId: 'license-9',
      licenseAssignedAt: assignedAt.toISOString(),
    });
  });

  it('reports a null license for unlicensed users', async () => {
    const users = await service.listCompanyUsers('company-1');

    expect(users.find((user) => user.id === 'user-1')).toMatchObject({
      activeLicenseId: null,
      licenseAssignedAt: null,
    });
  });

  it('returns an empty list for a company without users', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(service.listCompanyUsers('empty-company')).resolves.toEqual([]);
  });
});
