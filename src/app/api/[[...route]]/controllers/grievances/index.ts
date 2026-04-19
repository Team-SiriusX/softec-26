import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { Hono } from 'hono';

import {
  addTag,
  clusterGrievances,
  createGrievance,
  deleteGrievance,
  escalateGrievance,
  getForClustering,
  getGrievance,
  getGrievancePlatforms,
  getGrievanceStats,
  getGrievanceTrends,
  listGrievances,
  removeTag,
  resolveGrievance,
  updateGrievance,
} from './handlers';

const app = new Hono()
  .use('/', authMiddleware)
  .use('/*', authMiddleware)
  .get('/stats', getGrievanceStats)
  .get('/platforms', getGrievancePlatforms)
  .get('/for-cluster', getForClustering)
  .get('/', listGrievances)
  .get('/:id', getGrievance)
  .post('/cluster', clusterGrievances)
  .post('/trends', getGrievanceTrends)
  .post('/', createGrievance)
  .patch('/:id', updateGrievance)
  .delete('/:id', deleteGrievance)
  .post('/:id/tags', addTag)
  .delete('/:id/tags/:tag', removeTag)
  .post('/:id/escalate', escalateGrievance)
  .patch('/:id/resolve', resolveGrievance);

export default app;
