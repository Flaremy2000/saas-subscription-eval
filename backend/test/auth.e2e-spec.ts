import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { User } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'Password123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const users: Record<string, User> = {
  'admin@empresa.com': {
    id: 'user-admin',
    email: 'admin@empresa.com',
    name: 'Ana Admin',
    role: 'ADMIN',
    companyId: 'company-1',
    passwordHash,
    createdAt: new Date(),
  },
  'usuario@empresa.com': {
    id: 'user-regular',
    email: 'usuario@empresa.com',
    name: 'Luis User',
    role: 'USER',
    companyId: 'company-1',
    passwordHash,
    createdAt: new Date(),
  },
};

const prismaStub = {
  user: {
    findUnique: async ({ where }: { where: { email: string } }): Promise<User | null> =>
      users[where.email] ?? null,
  },
};

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  const loginAs = async (email: string): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a public health check', async () => {
    const res = await http().get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('rejects a login payload that fails validation', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '123', extra: true });

    expect(res.status).toBe(400);
  });

  it('rejects unknown accounts', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@empresa.com', password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it('rejects an incorrect password', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@empresa.com', password: 'WrongPass1!' });

    expect(res.status).toBe(401);
  });

  it('issues a bearer token on successful login', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@empresa.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      user: { email: 'admin@empresa.com', role: 'ADMIN' },
    });
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('rejects protected routes without a token', async () => {
    const res = await http().get('/api/v1/auth/me');

    expect(res.status).toBe(401);
  });

  it('returns the authenticated profile', async () => {
    const token = await loginAs('usuario@empresa.com');

    const res = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'usuario@empresa.com', role: 'USER' });
  });

  it('rejects tampered tokens', async () => {
    const res = await http().get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });

  it('returns usage metrics to authenticated users', async () => {
    const token = await loginAs('usuario@empresa.com');

    const res = await http().get('/api/v1/usage').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      usage: {
        totalLicenses: 100,
        usedLicenses: 42,
        availableLicenses: 58,
        usagePercentage: 42,
      },
      status: 'healthy',
    });
  });

  it('forbids non-admin users from assigning licenses', async () => {
    const token = await loginAs('usuario@empresa.com');

    const res = await http()
      .post('/api/v1/licenses/assign')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('allows admins to assign licenses', async () => {
    const token = await loginAs('admin@empresa.com');

    const res = await http()
      .post('/api/v1/licenses/assign')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'License assigned successfully' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await http().get('/api/v1/unknown');

    expect(res.status).toBe(404);
  });
});
