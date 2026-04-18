import { Hono } from 'hono'
import * as handlers from './handlers.js'

const grievanceRoutes = new Hono()

// Health — register first
grievanceRoutes.get('/health', handlers.healthCheck)

// Stats — register BEFORE /:id to avoid
// Express-style route conflict in Hono
grievanceRoutes.get('/grievances/stats', handlers.getStats)

// ML clustering bridge endpoint
grievanceRoutes.get('/grievances/for-clustering', handlers.getForClustering)

// Core CRUD
grievanceRoutes.get('/grievances', handlers.listGrievances)
grievanceRoutes.post('/grievances', handlers.createGrievance)
grievanceRoutes.get('/grievances/:id', handlers.getGrievance)
grievanceRoutes.patch('/grievances/:id', handlers.updateGrievance)
grievanceRoutes.delete('/grievances/:id', handlers.deleteGrievance)

// Tags
grievanceRoutes.post('/grievances/:id/tags', handlers.addTag)
grievanceRoutes.delete('/grievances/:id/tags/:tag', handlers.removeTag)

// Workflow
grievanceRoutes.post('/grievances/:id/escalate', handlers.escalateGrievance)
grievanceRoutes.patch('/grievances/:id/resolve', handlers.resolveGrievance)

export default grievanceRoutes
