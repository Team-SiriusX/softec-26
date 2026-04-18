import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { handle } from 'hono/vercel';
import { sample } from './controllers/(base)';
import analytics from './controllers/analytics';
import type { AnalyticsEnv } from './controllers/analytics/types';
import anomaly from './controllers/anomaly';
import certificates from './controllers/certificates';
import grievances from './controllers/grievances';
import screenshots from './controllers/screenshots';
import shifts from './controllers/shifts';

const app = new Hono<AnalyticsEnv>().basePath('/api');

app.onError((err, c) => {
  console.log(err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json({ message: 'Internal Error' }, 500);
});

export const routes = app
  .route('/sample', sample)
  .route('/shifts', shifts)
  .route('/screenshots', screenshots)
  .route('/grievances', grievances)
  .route('/analytics', analytics)
  .route('/certificates', certificates)
  .route('/anomaly', anomaly);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
