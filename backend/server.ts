import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/api/v1/usage') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        usage: {
          totalLicenses: 100,
          usedLicenses: 42,
          availableLicenses: 58,
          usagePercentage: 42,
        },
        status: 'healthy',
      }),
    );
    return;
  }

  if (url.pathname === '/api/v1/licenses/assign' && req.method === 'POST') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        success: true,
        message: 'License assigned successfully',
        licenseId: Math.floor(Math.random() * 10000),
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

export function createServer(): http.Server {
  return http.createServer(handleRequest);
}
