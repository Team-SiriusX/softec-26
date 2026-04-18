// FairGig scaffold — implement logic here
import { Hono } from 'hono';

import {
  getIncomeDistributionHandler,
  getPlatformStatsHandler,
  getVulnerabilityFlagsHandler,
} from './handlers';

const app = new Hono()
  .get('/platforms', getPlatformStatsHandler)
  .get('/vulnerability', getVulnerabilityFlagsHandler)
  .get('/distribution', getIncomeDistributionHandler);

export default app;
