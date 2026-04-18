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
  getGrievanceStats,
  getGrievanceTrends,
  listGrievances,
  removeTag,
  resolveGrievance,
  updateGrievance,
} from './handlers';

const app = new Hono()
  .use('/*', authMiddleware)
  .get('/stats', getGrievanceStats)
  .get('/for-cluster', getForClustering)
  .post('/cluster', clusterGrievances)
  .post('/trends', getGrievanceTrends)
  .get('/', listGrievances)
  .post('/', createGrievance)
  .get('/:id', getGrievance)
  .patch('/:id', updateGrievance)
  .delete('/:id', deleteGrievance)
  .post('/:id/tags', addTag)
  .delete('/:id/tags/:tag', removeTag)
  .post('/:id/escalate', escalateGrievance)
  .patch('/:id/resolve', resolveGrievance);

export default app;
