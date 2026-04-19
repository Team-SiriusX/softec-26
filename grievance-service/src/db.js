import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from './generated/prisma/index.js'

// Ensure this service resolves DB credentials from the shared repository env.
const currentFile = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFile)
const repoRoot = join(currentDir, '..', '..')

for (const envName of ['main.env', '.env']) {
  const envPath = join(repoRoot, envName)
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

const globalForPrisma = globalThis

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for grievance-service')
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: process.env.NODE_ENV === 'development'
    ? ['error', 'warn']
    : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
