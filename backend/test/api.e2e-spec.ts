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
const NOW = Date.now();

const ids = {
  company1: randomUUID(),
  company2: randomUUID(),
  admin: randomUUID(),
  regular: randomUUID(),
  licensed: randomUUID(),
  admin2: randomUUID(),
  external: randomUUID(),
  external2: randomUUID(),
  missing: '11111111-1111-4111-8111-111111111111',
};

const daysAgo = (days: number): Date => {
  const date = new Date(NOW - days * 24 * 60 * 60 * 1000);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const companies: Company[] = [
  {
    id: ids.company1,
    name: 'Acme',
    apiLimit: 100000,
    licenseLimit: 5,
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

const buildUser = (id: string, email: string, role: 'ADMIN' | 'USER', companyId: string): User => ({
  id,
  email,
  name: id,
  role,
  companyId,
  passwordHash,
  createdAt: new Date(),
});

const users: User[] = [
  buildUser(ids.admin, 'admin@empresa.com', 'ADMIN', ids.company1),
  buildUser(ids.regular, 'usuario@empresa.com', 'USER', ids.company1),
  buildUser(ids.licensed, 'licenciado@empresa.com', 'USER', ids.company1),
  buildUser(ids.admin2, 'admin2@empresa.com', 'ADMIN', ids.company2),
  buildUser(ids.external, 'externo@empresa.com', 'USER', ids.company2),
  buildUser(ids.external2, 'externo2@empresa.com', 'USER', ids.company2),
];

const licenses: License[] = [
  {
    id: 'license-1',
    status: 'ACTIVE',
    assignedAt: new Date(),
    revokedAt: null,
    userId: ids.licensed,
    companyId: ids.company1,
  },
  {
    id: 'license-2',
    status: 'ACTIVE',
    assignedAt: new Date(),
    revokedAt: null,
    userId: ids.external,
    companyId: ids.company2,
  },
];

const usageMetrics: UsageMetric[] = [
  { id: 'm-1', companyId: ids.company1, date: daysAgo(2), apiCalls: 3000 },
  { id: 'm-2', companyId: ids.company1, date: daysAgo(1), apiCalls: 2000 },
  { id: 'm-3', companyId: ids.company1, date: daysAgo(0), apiCalls: 1000 },
  { id: 'm-4', companyId: ids.company1, date: daysAgo(60), apiCalls: 999999 },
  { id: 'm-5', companyId: ids.company2, date: daysAgo(0), apiCalls: 900 },
];

describe('Usage API (e2e)', () => {
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
    prisma.usageMetrics.push(...usageMetrics);
    app = await createTestApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous requests', async () => {
    const res = await http().get('/api/v1/usage');

    expect(res.status).toBe(401);
  });

  it('returns the contracted limits and the last 30 days of consumption', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await http().get('/api/v1/usage').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      company: { id: ids.company1, name: 'Acme', apiLimit: 100000, licenseLimit: 5 },
      usage: { totalLicenses: 5, usedLicenses: 1, availableLicenses: 4, usagePercentage: 20 },
      api: { used: 6000, limit: 100000, usagePercentage: 6, exceeded: false },
      status: 'healthy',
    });
    expect(res.body.daily).toHaveLength(3);
    expect(res.body.daily.map((day: { date: string }) => day.date)).toEqual([
      daysAgo(2).toISOString().slice(0, 10),
      daysAgo(1).toISOString().slice(0, 10),
      daysAgo(0).toISOString().slice(0, 10),
    ]);
  });

  it('scopes the report to the caller company and warns at 80% usage', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await http().get('/api/v1/usage').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      company: { id: ids.company2, name: 'Globex', apiLimit: 1000, licenseLimit: 1 },
      usage: { totalLicenses: 1, usedLicenses: 1, availableLicenses: 0, usagePercentage: 100 },
      api: { used: 900, limit: 1000, usagePercentage: 90, exceeded: false },
      status: 'warning',
    });
    expect(res.body.daily).toHaveLength(1);
  });
});

describe('License assignment (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  const http = () => request(app.getHttpServer());

  const loginAs = async (email: string): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };

  const assign = (token: string, userId: string): request.Test =>
    http().post('/api/v1/licenses/assign').set('Authorization', `Bearer ${token}`).send({ userId });

  beforeAll(async () => {
    prisma = new FakePrisma();
    prisma.companies.push(...companies);
    prisma.users.push(...users);
    prisma.licenses.push(...licenses);
    prisma.usageMetrics.push(...usageMetrics);
    app = await createTestApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('forbids non-admin users', async () => {
    const token = await loginAs('usuario@empresa.com');

    const res = await assign(token, ids.regular);

    expect(res.status).toBe(403);
  });

  it('rejects payloads that fail validation', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await assign(token, 'not-a-uuid');

    expect(res.status).toBe(400);
  });

  it('assigns an active license to a company user', async () => {
    const token = await loginAs('admin@empresa.com');
    const licensesBefore = prisma.licenses.length;

    const res = await assign(token, ids.regular);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'License assigned successfully',
      license: {
        id: expect.any(String),
        userId: ids.regular,
        companyId: ids.company1,
        status: 'ACTIVE',
      },
    });
    expect(prisma.licenses).toHaveLength(licensesBefore + 1);
  });

  it('rejects users who already hold an active license', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await assign(token, ids.licensed);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ message: 'User already has an active license' });
  });

  it('does not leak users from other companies', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await assign(token, ids.external);

    expect(res.status).toBe(404);
  });

  it('rejects unknown users', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await assign(token, ids.missing);

    expect(res.status).toBe(404);
  });

  it('enforces the contracted license limit', async () => {
    const token = await loginAs('admin2@empresa.com');

    const res = await assign(token, ids.external2);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ message: 'License limit reached' });
  });
});
