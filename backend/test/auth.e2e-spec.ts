import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { User } from '../src/generated/prisma/client.js';
import { createTestApp } from './create-app.js';
import { FakePrisma } from './fakes/prisma.fake.js';

const PASSWORD = 'Password123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const users: User[] = [
  {
    id: 'user-admin',
    email: 'admin@empresa.com',
    name: 'Ana Admin',
    role: 'ADMIN',
    companyId: 'company-1',
    passwordHash,
    createdAt: new Date(),
  },
  {
    id: 'user-regular',
    email: 'usuario@empresa.com',
    name: 'Luis User',
    role: 'USER',
    companyId: 'company-1',
    passwordHash,
    createdAt: new Date(),
  },
];

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  const loginAs = async (email: string): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const prisma = new FakePrisma();
    prisma.users.push(...users);
    app = await createTestApp(prisma);
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

  it('returns 404 for unknown routes', async () => {
    const res = await http().get('/api/v1/unknown');

    expect(res.status).toBe(404);
  });
});
