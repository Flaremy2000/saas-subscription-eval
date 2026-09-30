import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from './server.ts';

describe('api server', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns usage summary on GET /api/v1/usage', async () => {
    const res = await fetch(`${baseUrl}/api/v1/usage`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.usage).toEqual({
      totalLicenses: 100,
      usedLicenses: 42,
      availableLicenses: 58,
      usagePercentage: 42,
    });
  });

  it('assigns a license on POST /api/v1/licenses/assign', async () => {
    const res = await fetch(`${baseUrl}/api/v1/licenses/assign`, { method: 'POST' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.licenseId).toBe('number');
  });

  it('does not assign a license on GET /api/v1/licenses/assign', async () => {
    const res = await fetch(`${baseUrl}/api/v1/licenses/assign`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Not found' });
  });
});
