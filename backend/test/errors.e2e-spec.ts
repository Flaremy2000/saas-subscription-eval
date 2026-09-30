import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Company, User } from '../src/generated/prisma/client.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { createTestApp } from './create-app.js';
import { FakePrisma } from './fakes/prisma.fake.js';

const PASSWORD = 'Password123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const ids = {
  company: randomUUID(),
  admin: randomUUID(),
  target: randomUUID(),
};

const company: Company = {
  id: ids.company,
  name: 'Error Co',
  apiLimit: 1000,
  licenseLimit: 3,
  createdAt: new Date(),
};

const admin: User = {
  id: ids.admin,
  email: 'admin@err.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: company.id,
  passwordHash,
  createdAt: new Date(),
};

const target: User = {
  id: ids.target,
  email: 'user@err.com',
  name: 'Luis User',
  role: 'USER',
  companyId: company.id,
  passwordHash,
  createdAt: new Date(),
};

describe('Error handling (e2e)', () => {
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
    prisma.companies.push(company);
    prisma.users.push(admin, target);
    app = await createTestApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a consistent envelope for unknown routes', async () => {
    const res = await http().get('/api/v1/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: expect.any(String),
      path: '/api/v1/unknown',
      timestamp: expect.any(String),
    });
  });

  it('returns a JSON envelope for malformed payloads', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{invalid');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: expect.any(String),
      error: 'Bad Request',
      path: '/api/v1/auth/login',
      timestamp: expect.any(String),
    });
  });

  it('hides internal failures behind a generic 500', async () => {
    vi.spyOn(prisma.company, 'findUnique').mockImplementation(() =>
      Promise.reject(new Error('secret db detail')),
    );
    const token = await loginAs('admin@err.com');

    const res = await http().get('/api/v1/usage').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/usage',
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain('secret db detail');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('maps unique constraint violations to 409', async () => {
    vi.spyOn(prisma.license, 'create').mockImplementation(() =>
      Promise.reject(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      ),
    );
    const token = await loginAs('admin@err.com');

    const res = await http()
      .post('/api/v1/licenses/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target.id });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      message: 'Resource already exists',
      error: 'Conflict',
      path: '/api/v1/licenses/assign',
      timestamp: expect.any(String),
    });
  });

  it('answers 503 when the database is unreachable', async () => {
    vi.spyOn(prisma.company, 'findUnique').mockImplementation(() =>
      Promise.reject(new Prisma.PrismaClientInitializationError('connect ECONNREFUSED', '7.10.0')),
    );
    const token = await loginAs('admin@err.com');

    const res = await http().get('/api/v1/usage').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      statusCode: 503,
      message: 'Service temporarily unavailable',
      error: 'Service Unavailable',
    });
  });
});
