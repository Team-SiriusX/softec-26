import { Hono } from 'hono'
import grievanceRoutes from './routes.js'
import { registerMiddleware } from './middleware.js'

const app = new Hono()

registerMiddleware(app)

app.onError((err, c) => {
  console.error('[grievance-service] Unhandled error:', err)
  return c.json({
    error: 'Internal server error',
    message: err.message,
    service: 'fairgig-grievance'
  }, 500)
})

const routes = app.route('/', grievanceRoutes)

app.notFound((c) => {
  return c.json({
    error: `Route ${c.req.method} ${c.req.path} not found`,
    service: 'fairgig-grievance'
  }, 404)
})

export { routes }
export default app
