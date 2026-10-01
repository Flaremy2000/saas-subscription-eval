import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PasswordHasher } from '../domain/password-hasher.js';
import type { TokenProvider } from '../domain/token-provider.js';
import type { UserRecord, UserRepository } from '../domain/user.repository.js';
import { AuthService } from './auth.service.js';
import type { LoginRequest } from '../presentation/dto/login.request.js';

const PASSWORD = 'Password123!';

const storedUser: UserRecord = {
  id: 'user-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'company-1',
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
};

describe('AuthService', () => {
  let service: AuthService;
  let users: { findByEmail: ReturnType<typeof vi.fn> };
  let hasher: PasswordHasher;
  let tokens: { sign: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    users = { findByEmail: vi.fn() };
    hasher = { compare: (plain: string, hash: string) => bcrypt.compare(plain, hash) };
    tokens = { sign: vi.fn().mockResolvedValue('signed-token') };
    service = new AuthService(
      users as unknown as UserRepository,
      hasher,
      tokens as unknown as TokenProvider,
    );
  });

  it('returns an access token for valid credentials', async () => {
    users.findByEmail.mockResolvedValue(storedUser);

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
    expect(tokens.sign).toHaveBeenCalledWith({
      sub: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: 'ADMIN',
      companyId: storedUser.companyId,
    });
  });

  it('rejects credentials for an unknown account', async () => {
    users.findByEmail.mockResolvedValue(null);

    const credentials: LoginRequest = { email: 'unknown@empresa.com', password: PASSWORD };

    await expect(service.login(credentials)).rejects.toThrow(UnauthorizedException);
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    users.findByEmail.mockResolvedValue(storedUser);

    const credentials: LoginRequest = { email: storedUser.email, password: 'WrongPass1!' };

    await expect(service.login(credentials)).rejects.toThrow('Invalid credentials');
    expect(tokens.sign).not.toHaveBeenCalled();
  });
});
