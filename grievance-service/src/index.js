import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(serviceRoot, '.env') });

import { serve } from '@hono/node-server';
import app from './app.js';
import { db } from './db.js';


function parsePort(rawPort) {
  const parsedPort = Number.parseInt(String(rawPort ?? ''), 10);
  if (!Number.isFinite(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return null;
  }

  return parsedPort;
}

function resolvePort() {
  const args = process.argv.slice(2);

  for (const arg of args) {
    if (arg.startsWith('--port=')) {
      const inlinePort = parsePort(arg.slice('--port='.length));
      if (inlinePort !== null) {
        return inlinePort;
      }
    }
    if (arg.startsWith('-p=')) {
      const inlinePort = parsePort(arg.slice('-p='.length));
      if (inlinePort !== null) {
        return inlinePort;
      }
    }
  }

  const portFlagIndex = args.findIndex(
    (arg) => arg === '--port' || arg === '-p',
  );
  if (portFlagIndex !== -1) {
    const flagPort = parsePort(args[portFlagIndex + 1]);
    if (flagPort !== null) {
      return flagPort;
    }
  }

  return parsePort(process.env.PORT) ?? 8003;
}

const PORT = resolvePort();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[grievance-service] Shutting down...');
  await db.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await db.$disconnect();
  process.exit(0);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`FairGig Grievance Service running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Docs:   http://localhost:${PORT}/grievances/stats`);
});
