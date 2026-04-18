import { Hono } from 'hono';

import {
  getIncomeDistributionHandler,
  getMedianHandler,
  getPlatformStatsHandler,
  getVulnerabilityFlagsHandler,
} from './handlers';

const app = new Hono()
  .get('/platforms', getPlatformStatsHandler)
  .get('/median', getMedianHandler)
  .get('/vulnerability', getVulnerabilityFlagsHandler)
  .get('/distribution', getIncomeDistributionHandler);

export default app;
