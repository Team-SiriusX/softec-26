import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}
import { serve } from '@hono/node-server'
import app from './app.js'
import { db } from './db.js'

const PORT = parseInt(process.env.PORT || '8003')

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[grievance-service] Shutting down...')
  await db.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await db.$disconnect()
  process.exit(0)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`FairGig Grievance Service running on port ${PORT}`)
  console.log(`Health: http://localhost:${PORT}/health`)
  console.log(`Docs:   http://localhost:${PORT}/grievances/stats`)
})
