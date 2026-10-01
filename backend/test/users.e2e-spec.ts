import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Company, License, UsageMetric, User } from '../src/generated/prisma/client.js';
import { createTestApp } from './create-app.js';
import { FakePrisma } from './fakes/prisma.fake.js';

const PASSWORD = 'Password123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const ids = {
  company1: randomUUID(),
  company2: randomUUID(),
  admin: randomUUID(),
  licensed: randomUUID(),
  member: randomUUID(),
  revoked: randomUUID(),
  admin2: randomUUID(),
  external: randomUUID(),
  missing: '11111111-1111-4111-8111-111111111111',
};

const companies: Company[] = [
  {
    id: ids.company1,
    name: 'Acme',
    apiLimit: 100000,
    licenseLimit: 25,
    createdAt: new Date(),
  },
  {
    id: ids.company2,
    name: 'Globex',
    apiLimit: 1000,
    licenseLimit: 1,
    createdAt: new Date(),
  },
];

const buildUser = (
  id: string,
  name: string,
  email: string,
  role: 'ADMIN' | 'USER',
  companyId: string,
): User => ({
  id,
  email,
  name,
  role,
  companyId,
  passwordHash,
  createdAt: new Date(),
});

const users: User[] = [
  buildUser(ids.admin, 'Ana Admin', 'admin@empresa.com', 'ADMIN', ids.company1),
  buildUser(ids.licensed, 'Beto Licenciado', 'licenciado@empresa.com', 'USER', ids.company1),
  buildUser(ids.member, 'Carlos Usuario', 'usuario@empresa.com', 'USER', ids.company1),
  buildUser(ids.revoked, 'Dana Revocada', 'dana@empresa.com', 'USER', ids.company1),
  buildUser(ids.admin2, 'Eva Admin', 'admin2@empresa.com', 'ADMIN', ids.company2),
  buildUser(ids.external, 'Fernando Externo', 'externo@empresa.com', 'USER', ids.company2),
];

const licenses: License[] = [
  {
    id: 'active-license',
    status: 'ACTIVE',
    assignedAt: new Date('2026-01-10T00:00:00.000Z'),
    revokedAt: null,
    userId: ids.licensed,
    companyId: ids.company1,
  },
  {
    id: 'revoked-license',
    status: 'REVOKED',
    assignedAt: new Date('2025-12-01T00:00:00.000Z'),
    revokedAt: new Date('2025-12-15T00:00:00.000Z'),
    userId: ids.revoked,
    companyId: ids.company1,
  },
];

describe('Users API (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  const http = () => request(app.getHttpServer());

  const loginAs = async (email: string): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    prisma = new FakePrisma();
    prisma.companies.push(...companies);
    prisma.users.push(...users);
    prisma.licenses.push(...licenses);
    prisma.usageMetrics.push(...([] as UsageMetric[]));
    app = await createTestApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous requests', async () => {
    const res = await http().get('/api/v1/users');

    expect(res.status).toBe(401);
  });

  it('lists company users ordered by name with their active license', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await http().get('/api/v1/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.map((user: { name: string }) => user.name)).toEqual([
      'Ana Admin',
      'Beto Licenciado',
      'Carlos Usuario',
      'Dana Revocada',
    ]);

    const licensed = res.body.users.find((user: { id: string }) => user.id === ids.licensed);
    expect(licensed).toMatchObject({
      email: 'licenciado@empresa.com',
      role: 'USER',
      activeLicenseId: 'active-license',
      licenseAssignedAt: '2026-01-10T00:00:00.000Z',
    });

    const revoked = res.body.users.find((user: { id: string }) => user.id === ids.revoked);
    expect(revoked).toMatchObject({ activeLicenseId: null, licenseAssignedAt: null });
  });

  it('forbids regular members from listing the roster', async () => {
    const token = await loginAs('usuario@empresa.com');

    const res = await http().get('/api/v1/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('does not leak users from other companies', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await http().get('/api/v1/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users.map((user: { id: string }) => user.id)).toEqual([
      ids.admin2,
      ids.external,
    ]);
  });
});

describe('User roles (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  const admin3 = randomUUID();

  const http = () => request(app.getHttpServer());

  const loginAs = async (email: string): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };

  const changeRole = (token: string, userId: string, role: string): request.Test =>
    http()
      .patch(`/api/v1/users/${userId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role });

  beforeAll(async () => {
    prisma = new FakePrisma();
    prisma.companies.push(...companies);
    prisma.users.push(
      ...users,
      buildUser(admin3, 'Gina Admin', 'admin3@empresa.com', 'ADMIN', ids.company2),
    );
    app = await createTestApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('forbids non-admin users', async () => {
    const token = await loginAs('usuario@empresa.com');

    const res = await changeRole(token, ids.external, 'ADMIN');

    expect(res.status).toBe(403);
  });

  it('rejects payloads with an unknown role', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, ids.external, 'SUPERUSER');

    expect(res.status).toBe(400);
  });

  it('rejects ids that are not uuids', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, 'not-a-uuid', 'ADMIN');

    expect(res.status).toBe(400);
  });

  it('promotes a member to admin within the company', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, ids.external, 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: ids.external,
        email: 'externo@empresa.com',
        name: 'Fernando Externo',
        role: 'ADMIN',
      },
    });
    expect(prisma.users.find((user) => user.id === ids.external)?.role).toBe('ADMIN');
  });

  it('rejects changing your own role', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, ids.admin2, 'USER');

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ message: 'You cannot change your own role' });
    expect(prisma.users.find((user) => user.id === ids.admin2)?.role).toBe('ADMIN');
  });

  it('does not leak users from other companies', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, ids.member, 'ADMIN');

    expect(res.status).toBe(404);
  });

  it('rejects unknown users', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, ids.missing, 'ADMIN');

    expect(res.status).toBe(404);
  });

  it('demotes an admin when other admins remain', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await changeRole(token, admin3, 'USER');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'USER' });
    expect(prisma.users.find((user) => user.id === admin3)?.role).toBe('USER');
  });
});
