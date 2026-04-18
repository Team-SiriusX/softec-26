import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

export function registerMiddleware(app) {
  app.use('*', logger())
  app.use('*', prettyJSON())
  app.use('*', cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8003'
    ],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization']
  }))
}
