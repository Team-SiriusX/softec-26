import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

const ADVISOR_SERVICE_URL =
  process.env.ADVISOR_SERVICE_URL ?? 'http://localhost:8001';

const advisorQuerySchema = z.object({
  query: z.string().min(1),
  locale: z.enum(['en', 'ur']).optional().default('en'),
});

const app = new Hono()
  .use('/*', authMiddleware)
  .post('/query', zValidator('json', advisorQuerySchema), async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${ADVISOR_SERVICE_URL}/advisor/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worker_id: user.id,
          query: body.query,
          locale: body.locale,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const payload = await response.json();
        return c.json(payload, response.status as 200);
      }

      const text = await response.text();
      return c.body(text, response.status as 200, {
        'Content-Type': contentType || 'text/plain',
      });
    } catch {
      clearTimeout(timeout);
      return c.json({ message: 'Advisor service unavailable' }, 503);
    }
  });

export default app;
