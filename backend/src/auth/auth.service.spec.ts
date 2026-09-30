import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { LoginRequest } from './dto/login.request.js';

const PASSWORD = 'Password123!';

const storedUser = {
  id: 'user-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN' as const,
  companyId: 'company-1',
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn() } };
    jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  });

  it('returns an access token for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);

    const credentials: LoginRequest = { email: storedUser.email, password: PASSWORD };
    const result = await service.login(credentials);

    expect(result.accessToken).toBe('signed-token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.user).toEqual({
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: 'ADMIN',
      companyId: storedUser.companyId,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: 'ADMIN',
      companyId: storedUser.companyId,
    });
  });

  it('rejects credentials for an unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const credentials: LoginRequest = { email: 'unknown@empresa.com', password: PASSWORD };

    await expect(service.login(credentials)).rejects.toThrow(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);

    const credentials: LoginRequest = { email: storedUser.email, password: 'WrongPass1!' };

    await expect(service.login(credentials)).rejects.toThrow('Invalid credentials');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
