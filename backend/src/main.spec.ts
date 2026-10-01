import { beforeEach, describe, expect, it, vi } from 'vitest';

const { app } = vi.hoisted(() => ({
  app: {
    setGlobalPrefix: vi.fn().mockReturnThis(),
    listen: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@nestjs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/core')>();
  return {
    ...actual,
    NestFactory: { ...actual.NestFactory, create: vi.fn().mockResolvedValue(app) },
  };
});

describe('bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves the API behind the versioned prefix', async () => {
    await import('./main.js');
    await vi.waitFor(() => expect(app.listen).toHaveBeenCalled());

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
    expect(app.listen).toHaveBeenCalledWith(Number(process.env['PORT'] ?? 3000));
  });
});
