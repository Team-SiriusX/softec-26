import 'dotenv/config'
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
