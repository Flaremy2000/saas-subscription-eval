import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../presentation/decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class TestController {
  handler(): void {
    return undefined;
  }
}

const handler = TestController.prototype.handler;

const adminUser: Express.User = {
  sub: 'user-1',
  email: 'admin@empresa.com',
  name: 'Ana Admin',
  role: 'ADMIN',
  companyId: 'company-1',
};

const regularUser: Express.User = {
  sub: 'user-2',
  email: 'usuario@empresa.com',
  name: 'Luis User',
  role: 'USER',
  companyId: 'company-1',
};

function createContext(user: Express.User | undefined): ExecutionContext {
  return {
    getClass: () => TestController,
    getHandler: () => handler,
    getType: () => 'http',
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => ({ user }),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    Reflect.defineMetadata(ROLES_KEY, undefined, handler);
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows routes without role restrictions', () => {
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('allows users holding a required role', () => {
    Reflect.defineMetadata(ROLES_KEY, ['ADMIN'], handler);

    expect(guard.canActivate(createContext(adminUser))).toBe(true);
  });

  it('rejects users without the required role', () => {
    Reflect.defineMetadata(ROLES_KEY, ['ADMIN'], handler);

    expect(guard.canActivate(createContext(regularUser))).toBe(false);
  });

  it('rejects unauthenticated requests on restricted routes', () => {
    Reflect.defineMetadata(ROLES_KEY, ['ADMIN'], handler);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });
});
