import { createServer } from './server.ts';

const PORT = process.env.PORT || 3000;

const server = createServer();

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/v1/usage`);
  console.log(`  POST /api/v1/licenses/assign`);
});
