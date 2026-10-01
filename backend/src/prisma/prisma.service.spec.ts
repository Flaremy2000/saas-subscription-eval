import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  let service: PrismaService;
  let connect: ReturnType<typeof vi.spyOn>;
  let disconnect: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new PrismaService();
    connect = vi.spyOn(service, '$connect').mockResolvedValue(undefined);
    disconnect = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);
  });

  it('opens the database connection on module init', async () => {
    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('closes the database connection on module destroy', async () => {
    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
