import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { handle } from 'hono/vercel';
import { sample, me } from './controllers/(base)';
import admin from './controllers/admin';
import ai from './controllers/ai';
import analytics from './controllers/analytics';
import type { AnalyticsEnv } from './controllers/analytics/types';
import anomaly from './controllers/anomaly';
import certificates from './controllers/certificates';
import community from './controllers/community';
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
  .route('/me', me)
  .route('/sample', sample)
  .route('/ai', ai)
  .route('/admin', admin)
  .route('/community', community)
  .route('/shifts', shifts)
  .route('/screenshots', screenshots)
  .route('/grievances', grievances)
  .route('/analytics', analytics)
  .route('/certificates', certificates)
  .route('/anomaly', anomaly)

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
